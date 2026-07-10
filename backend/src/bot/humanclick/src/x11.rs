// Native XTEST input layer. Talks the X11 protocol directly via x11rb (pure
// Rust, no libX11/libXtest linkage and no xdotool subprocess) so this binary
// has no runtime dependency beyond reaching the X server on $DISPLAY.
//
// XTEST-synthesized events are injected by the X server itself, so listeners
// in the browser see genuine MotionNotify/ButtonPress/KeyPress events with
// `isTrusted: true` — unlike CDP/Playwright's synthetic input dispatch.

use std::thread::sleep;
use std::time::Duration;

use anyhow::{bail, Context, Result};
use x11rb::connection::Connection;
use x11rb::protocol::xproto::ConnectionExt as _;
use x11rb::protocol::xtest::ConnectionExt as _;
use x11rb::rust_connection::RustConnection;

const MOTION_NOTIFY: u8 = 6;
const BUTTON_PRESS: u8 = 4;
const BUTTON_RELEASE: u8 = 5;
const KEY_PRESS: u8 = 2;
const KEY_RELEASE: u8 = 3;

/// Keysym for Shift_L, used to hold shift while typing an uppercase/shifted char.
const KEYSYM_SHIFT_L: u32 = 0xffe1;

pub struct X11Session {
    conn: RustConnection,
    root: u32,
    min_keycode: u8,
    keysyms_per_keycode: u8,
    keymap: Vec<u32>,
    /// Keycode reserved (highest available) for on-the-fly remapping of
    /// keysyms not present in the current layout (mirrors what `xdotool
    /// type` does for characters outside the active keymap).
    scratch_keycode: u8,
    shift_keycode: u8,
}

impl X11Session {
    pub fn connect(display: Option<&str>) -> Result<Self> {
        let (conn, screen_num) = x11rb::connect(display)
            .with_context(|| format!("failed to connect to X display {display:?}"))?;
        let root = conn.setup().roots[screen_num].root;

        let setup = conn.setup();
        let min_keycode = setup.min_keycode;
        let max_keycode = setup.max_keycode;

        let mapping = conn
            .get_keyboard_mapping(min_keycode, max_keycode - min_keycode + 1)?
            .reply()
            .context("GetKeyboardMapping failed")?;
        let keysyms_per_keycode = mapping.keysyms_per_keycode;
        let keymap = mapping.keysyms;

        let shift_keycode =
            keysym_to_keycode_in(KEYSYM_SHIFT_L, min_keycode, keysyms_per_keycode, &keymap)
                .map(|(kc, _)| kc)
                .unwrap_or(50); // 50 is Shift_L on essentially every standard layout; fallback only.

        Ok(Self {
            conn,
            root,
            min_keycode,
            keysyms_per_keycode,
            keymap,
            scratch_keycode: max_keycode,
            shift_keycode,
        })
    }

    pub fn is_available(&self) -> bool {
        !self.conn.setup().roots.is_empty()
    }

    pub fn query_pointer(&self) -> Result<(i16, i16)> {
        let reply = self
            .conn
            .query_pointer(self.root)?
            .reply()
            .context("QueryPointer failed")?;
        Ok((reply.root_x, reply.root_y))
    }

    pub fn move_abs(&self, x: i16, y: i16) -> Result<()> {
        self.conn
            .xtest_fake_input(MOTION_NOTIFY, 0, 0, self.root, x, y, 0)?
            .check()
            .context("XTestFakeInput(MotionNotify, absolute) failed")?;
        self.conn.flush()?;
        Ok(())
    }

    pub fn move_rel(&self, dx: i16, dy: i16) -> Result<()> {
        self.conn
            .xtest_fake_input(MOTION_NOTIFY, 1, 0, self.root, dx, dy, 0)?
            .check()
            .context("XTestFakeInput(MotionNotify, relative) failed")?;
        self.conn.flush()?;
        Ok(())
    }

    pub fn button(&self, button: u8, press: bool) -> Result<()> {
        let ty = if press { BUTTON_PRESS } else { BUTTON_RELEASE };
        self.conn
            .xtest_fake_input(ty, button, 0, self.root, 0, 0, 0)?
            .check()
            .context("XTestFakeInput(Button) failed")?;
        self.conn.flush()?;
        Ok(())
    }

    fn key(&self, keycode: u8, press: bool) -> Result<()> {
        let ty = if press { KEY_PRESS } else { KEY_RELEASE };
        self.conn
            .xtest_fake_input(ty, keycode, 0, self.root, 0, 0, 0)?
            .check()
            .context("XTestFakeInput(Key) failed")?;
        self.conn.flush()?;
        Ok(())
    }

    /// Resolve `ch` to a (keycode, needs_shift) pair, remapping the scratch
    /// keycode on the fly if the character isn't in the current layout.
    fn resolve_char(&mut self, ch: char) -> Result<(u8, bool)> {
        let keysym = char_to_keysym(ch)
            .with_context(|| format!("no keysym mapping for character {ch:?}"))?;

        if let Some(hit) = keysym_to_keycode_in(
            keysym,
            self.min_keycode,
            self.keysyms_per_keycode,
            &self.keymap,
        ) {
            return Ok(hit);
        }

        // Not present in the live layout: remap the scratch keycode to this
        // keysym (column 0) so it becomes typeable, same trick xdotool uses
        // for out-of-layout characters.
        self.conn
            .change_keyboard_mapping(
                1,
                self.scratch_keycode,
                self.keysyms_per_keycode,
                &vec![keysym; self.keysyms_per_keycode as usize],
            )?
            .check()
            .context("ChangeKeyboardMapping failed")?;
        self.conn.flush()?;
        // X servers require a short settle after a keymap change before the
        // new mapping is honored by clients.
        sleep(Duration::from_millis(30));

        // Mirror the remap into our local cache so a repeated occurrence of
        // this character later in the same `type_text` call is resolved
        // without another round trip to the server.
        let idx = ((self.scratch_keycode - self.min_keycode) as usize)
            * self.keysyms_per_keycode as usize;
        if idx < self.keymap.len() {
            self.keymap[idx] = keysym;
        }
        Ok((self.scratch_keycode, false))
    }

    pub fn type_text(&mut self, text: &str, min_delay_ms: u64, max_delay_ms: u64) -> Result<()> {
        use rand::Rng;
        let mut rng = rand::thread_rng();
        for ch in text.chars() {
            let (keycode, needs_shift) = self.resolve_char(ch)?;
            if needs_shift {
                self.key(self.shift_keycode, true)?;
                sleep(Duration::from_millis(8));
            }
            self.key(keycode, true)?;
            sleep(Duration::from_millis(10 + rng.gen_range(0..15)));
            self.key(keycode, false)?;
            if needs_shift {
                sleep(Duration::from_millis(6));
                self.key(self.shift_keycode, false)?;
            }
            let delay = if max_delay_ms > min_delay_ms {
                rng.gen_range(min_delay_ms..max_delay_ms)
            } else {
                min_delay_ms
            };
            sleep(Duration::from_millis(delay));
        }
        Ok(())
    }
}

/// Resolve `ch` to an X11 keysym with no lookup table:
///   - ASCII/Latin-1 printable keysyms are numerically identical to the
///     character's code point (X11 keysymdef.h).
///   - Everything else (em dash, curly quotes, emoji, ...) uses the
///     documented Unicode keysym convention keysym = 0x01000000 + codepoint,
///     which Xorg's keysym-to-UTF8 tables (and thus Chromium/GTK's input
///     handling) resolve back to the original character.
fn char_to_keysym(ch: char) -> Option<u32> {
    let code = ch as u32;
    if (0x20..=0x7e).contains(&code) || (0xa0..=0xff).contains(&code) {
        Some(code)
    } else if code >= 0x100 {
        Some(0x0100_0000 + code)
    } else {
        None
    }
}

/// Whether `keysym` requires the Shift modifier to type, based on the
/// standard US layout ASCII shift-pairs. Falls back to "no shift" for
/// anything outside that set (digits/letters/space already handled above).
fn needs_shift_for(keysym: u32) -> bool {
    if (b'A' as u32..=b'Z' as u32).contains(&keysym) {
        return true;
    }
    matches!(
        keysym,
        0x21 | 0x40
            | 0x23
            | 0x24
            | 0x25
            | 0x5e
            | 0x26
            | 0x2a
            | 0x28
            | 0x29
            | 0x5f
            | 0x2b
            | 0x7b
            | 0x7d
            | 0x7c
            | 0x3a
            | 0x22
            | 0x3c
            | 0x3e
            | 0x3f
            | 0x7e
    )
}

fn keysym_to_keycode_in(
    keysym: u32,
    min_keycode: u8,
    keysyms_per_keycode: u8,
    keymap: &[u32],
) -> Option<(u8, bool)> {
    let per = keysyms_per_keycode as usize;
    for (i, chunk) in keymap.chunks(per).enumerate() {
        for (col, &ks) in chunk.iter().enumerate() {
            if ks == keysym {
                let keycode = min_keycode as usize + i;
                if keycode > u8::MAX as usize {
                    continue;
                }
                let shift = col == 1 || needs_shift_for(keysym);
                return Some((keycode as u8, shift));
            }
        }
    }
    None
}

pub fn require_available(session: &X11Session) -> Result<()> {
    if !session.is_available() {
        bail!("X server has no screens; DISPLAY is not usable");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ascii_keysym_equals_code_point() {
        assert_eq!(char_to_keysym('A'), Some(0x41));
        assert_eq!(char_to_keysym(' '), Some(0x20));
    }

    #[test]
    fn latin1_extended_keysym_equals_code_point() {
        assert_eq!(char_to_keysym('é'), Some(0xe9));
    }

    #[test]
    fn beyond_latin1_uses_unicode_keysym_convention() {
        // Em dash, U+2014 — found live in a bot display name and previously
        // rejected outright, forcing a fallback to Playwright's synthetic
        // fill for the whole field.
        assert_eq!(char_to_keysym('\u{2014}'), Some(0x0100_0000 + 0x2014));
        // An emoji, to confirm the convention isn't accidentally limited to
        // the BMP.
        assert_eq!(char_to_keysym('🙂'), Some(0x0100_0000 + 0x1f642));
    }

    #[test]
    fn control_characters_have_no_keysym() {
        assert_eq!(char_to_keysym('\n'), None);
        assert_eq!(char_to_keysym('\u{7f}'), None);
    }
}

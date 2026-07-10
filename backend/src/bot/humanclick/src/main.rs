mod motion;
mod x11;

use std::process::ExitCode;
use std::thread::sleep;
use std::time::{Duration, Instant};

use anyhow::Result;
use clap::{Parser, Subcommand};
use rand::Rng;
use serde::Serialize;

use motion::Rect;
use x11::X11Session;

#[derive(Parser)]
#[command(
    name = "humanclick",
    about = "Real XTEST pointer/keyboard input with human-like motion synthesis"
)]
struct Cli {
    /// X display to target, e.g. :99. Defaults to $DISPLAY.
    #[arg(long, global = true)]
    display: Option<String>,

    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Check that the X server is reachable.
    Available,
    /// Report the real hardware pointer position (device px, screen coords).
    Pointer,
    /// Jump the pointer directly to an absolute screen position (used for
    /// calibration probes and corrective recalibration nudges).
    MoveAbs {
        #[arg(long, allow_hyphen_values = true)]
        x: i16,
        #[arg(long, allow_hyphen_values = true)]
        y: i16,
    },
    /// Move the pointer from its current position to a randomized point
    /// inside the given target rect, along a synthesized human trajectory.
    Move {
        #[arg(long, allow_hyphen_values = true)]
        to_left: f64,
        #[arg(long, allow_hyphen_values = true)]
        to_top: f64,
        #[arg(long, allow_hyphen_values = true)]
        to_right: f64,
        #[arg(long, allow_hyphen_values = true)]
        to_bottom: f64,
        /// Deterministic seed, for tests only.
        #[arg(long)]
        seed: Option<u64>,
    },
    /// Press and release a mouse button with randomized human-scale timing.
    Click {
        #[arg(long, default_value_t = 1)]
        button: u8,
        #[arg(long, default_value_t = 60)]
        down_min_ms: u64,
        #[arg(long, default_value_t = 110)]
        down_max_ms: u64,
        #[arg(long, default_value_t = 50)]
        up_min_ms: u64,
        #[arg(long, default_value_t = 100)]
        up_max_ms: u64,
    },
    /// Type literal text via XTEST keystrokes with a jittered per-char delay.
    Type {
        #[arg(long)]
        text: String,
        #[arg(long, default_value_t = 55)]
        min_delay_ms: u64,
        #[arg(long, default_value_t = 105)]
        max_delay_ms: u64,
    },
}

#[derive(Serialize)]
struct ErrorOut {
    error: String,
}

fn jitter_ms(rng: &mut impl Rng, min: u64, max: u64) -> u64 {
    if max > min {
        rng.gen_range(min..max)
    } else {
        min
    }
}

fn run(cli: Cli) -> Result<serde_json::Value> {
    let mut session = X11Session::connect(cli.display.as_deref())?;
    x11::require_available(&session)?;

    match cli.command {
        Command::Available => Ok(serde_json::json!({ "available": true })),

        Command::Pointer => {
            let (x, y) = session.query_pointer()?;
            Ok(serde_json::json!({ "x": x, "y": y }))
        }

        Command::MoveAbs { x, y } => {
            session.move_abs(x, y)?;
            let (rx, ry) = session.query_pointer()?;
            Ok(serde_json::json!({ "x": rx, "y": ry }))
        }

        Command::Move {
            to_left,
            to_top,
            to_right,
            to_bottom,
            seed,
        } => {
            let (start_x, start_y) = session.query_pointer()?;
            let rect = Rect {
                left: to_left,
                top: to_top,
                right: to_right,
                bottom: to_bottom,
            };
            let traj = motion::synthesize(start_x as f64, start_y as f64, rect, seed);

            let started = Instant::now();
            for step in &traj.steps {
                session.move_rel(step.dx as i16, step.dy as i16)?;
                sleep(Duration::from_secs_f64(step.dt));
            }
            let (rx, ry) = session.query_pointer()?;
            Ok(serde_json::json!({
                "x": rx,
                "y": ry,
                "aimed_x": traj.target_x,
                "aimed_y": traj.target_y,
                "steps": traj.steps.len(),
                "elapsed_ms": started.elapsed().as_millis(),
            }))
        }

        Command::Click {
            button,
            down_min_ms,
            down_max_ms,
            up_min_ms,
            up_max_ms,
        } => {
            let mut rng = rand::thread_rng();
            sleep(Duration::from_millis(jitter_ms(
                &mut rng,
                down_min_ms,
                down_max_ms,
            )));
            session.button(button, true)?;
            sleep(Duration::from_millis(jitter_ms(
                &mut rng, up_min_ms, up_max_ms,
            )));
            session.button(button, false)?;
            Ok(serde_json::json!({ "clicked": true, "button": button }))
        }

        Command::Type {
            text,
            min_delay_ms,
            max_delay_ms,
        } => {
            session.type_text(&text, min_delay_ms, max_delay_ms)?;
            Ok(serde_json::json!({ "typed": text.chars().count() }))
        }
    }
}

fn main() -> ExitCode {
    let cli = Cli::parse();
    match run(cli) {
        Ok(value) => {
            println!("{value}");
            ExitCode::SUCCESS
        }
        Err(err) => {
            let out = ErrorOut {
                error: format!("{err:#}"),
            };
            eprintln!(
                "{}",
                serde_json::to_string(&out).unwrap_or_else(|_| "{\"error\":\"unknown\"}".into())
            );
            ExitCode::FAILURE
        }
    }
}

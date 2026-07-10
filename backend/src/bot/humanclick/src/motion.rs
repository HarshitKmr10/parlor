// Algorithmic human-motion synthesis.
//
// Original approach, no recorded/mocap data: a cubic Bezier path between the
// current pointer position and a randomized point inside the target rect,
// sampled along a minimum-jerk (ease-in/ease-out) time profile, with small
// perpendicular jitter that fades out near the endpoint, and total duration
// scaled by Fitts's Law so short/easy moves are fast and long/precise ones
// take longer — the same relationship real pointing movements follow.

use rand::rngs::StdRng;
use rand::{Rng, SeedableRng};

#[derive(Debug, Clone, Copy)]
pub struct Rect {
    pub left: f64,
    pub top: f64,
    pub right: f64,
    pub bottom: f64,
}

impl Rect {
    pub fn width(&self) -> f64 {
        self.right - self.left
    }
    pub fn height(&self) -> f64 {
        self.bottom - self.top
    }
}

/// One relative pointer step: move by (dx, dy) device px, then wait `dt`
/// seconds before the next step.
#[derive(Debug, Clone, Copy)]
pub struct Step {
    pub dx: i32,
    pub dy: i32,
    pub dt: f64,
}

pub struct Trajectory {
    pub steps: Vec<Step>,
    pub target_x: f64,
    pub target_y: f64,
}

const FITTS_A: f64 = 0.12; // seconds, fixed overhead (reaction + settle)
const FITTS_B: f64 = 0.17; // seconds per bit of index-of-difficulty
const MIN_STEP_DT: f64 = 0.008;
const MAX_STEP_DT: f64 = 0.018;

fn make_rng(seed: Option<u64>) -> StdRng {
    match seed {
        Some(s) => StdRng::seed_from_u64(s),
        None => StdRng::from_entropy(),
    }
}

/// Minimum-jerk ease: zero velocity and acceleration at both endpoints.
fn ease(t: f64) -> f64 {
    10.0 * t.powi(3) - 15.0 * t.powi(4) + 6.0 * t.powi(5)
}

pub fn synthesize(from_x: f64, from_y: f64, target: Rect, seed: Option<u64>) -> Trajectory {
    let mut rng = make_rng(seed);

    // Aim at the central ~64% of the rect (matches the "don't click the
    // very edge of the button" heuristic humans naturally follow).
    let inset_x = target.width() * 0.18;
    let inset_y = target.height() * 0.18;
    let tx = target.left + inset_x + rng.gen::<f64>() * (target.width() - 2.0 * inset_x).max(1.0);
    let ty = target.top + inset_y + rng.gen::<f64>() * (target.height() - 2.0 * inset_y).max(1.0);

    let dx = tx - from_x;
    let dy = ty - from_y;
    let distance = (dx * dx + dy * dy).sqrt().max(1.0);
    let target_width = target.width().min(target.height()).max(8.0);

    let duration = FITTS_A + FITTS_B * (distance / target_width + 1.0).log2();
    let n_steps = ((duration / 0.013).round() as usize).clamp(6, 220);

    // Perpendicular unit vector, for both the curve's control-point bow and
    // per-step jitter.
    let perp_x = -dy / distance;
    let perp_y = dx / distance;

    // Bow the path to one side by a random amount proportional to distance —
    // real pointer movements are rarely perfectly straight.
    let bow_sign = if rng.gen_bool(0.5) { 1.0 } else { -1.0 };
    let bow = bow_sign * distance * (0.06 + rng.gen::<f64>() * 0.10);
    let ctrl_x = from_x + dx * 0.5 + perp_x * bow;
    let ctrl_y = from_y + dy * 0.5 + perp_y * bow;

    let mut points: Vec<(f64, f64)> = Vec::with_capacity(n_steps + 1);
    for i in 0..=n_steps {
        let t = i as f64 / n_steps as f64;
        let s = ease(t);
        // Quadratic Bezier: P = (1-s)^2*from + 2(1-s)s*ctrl + s^2*target.
        let inv = 1.0 - s;
        let bx = inv * inv * from_x + 2.0 * inv * s * ctrl_x + s * s * tx;
        let by = inv * inv * from_y + 2.0 * inv * s * ctrl_y + s * s * ty;

        // High-frequency jitter, damped to ~0 in the final 15% of the path
        // so the endpoint lands cleanly inside the rect.
        let damp = if t > 0.85 {
            ((1.0 - t) / 0.15).max(0.0)
        } else {
            1.0
        };
        let jitter = (rng.gen::<f64>() - 0.5) * 2.4 * damp;
        points.push((bx + perp_x * jitter, by + perp_y * jitter));
    }
    // Force an exact landing so the caller's rect check always passes.
    if let Some(last) = points.last_mut() {
        *last = (tx, ty);
    }

    let mut steps = Vec::with_capacity(n_steps);
    let mut cursor = (from_x, from_y);
    let mut carry = (0.0, 0.0);
    for p in points {
        let want_dx = p.0 - cursor.0 + carry.0;
        let want_dy = p.1 - cursor.1 + carry.1;
        let idx = want_dx.round() as i32;
        let idy = want_dy.round() as i32;
        carry = (want_dx - idx as f64, want_dy - idy as f64);
        cursor = (cursor.0 + idx as f64, cursor.1 + idy as f64);
        if idx == 0 && idy == 0 {
            continue;
        }
        let dt = MIN_STEP_DT + rng.gen::<f64>() * (MAX_STEP_DT - MIN_STEP_DT);
        steps.push(Step {
            dx: idx,
            dy: idy,
            dt,
        });
    }

    Trajectory {
        steps,
        target_x: tx,
        target_y: ty,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rect(l: f64, t: f64, r: f64, b: f64) -> Rect {
        Rect {
            left: l,
            top: t,
            right: r,
            bottom: b,
        }
    }

    #[test]
    fn lands_inside_target_rect() {
        let r = rect(500.0, 300.0, 560.0, 330.0);
        for seed in 0..50 {
            let traj = synthesize(100.0, 100.0, r, Some(seed));
            assert!(traj.target_x >= r.left && traj.target_x <= r.right);
            assert!(traj.target_y >= r.top && traj.target_y <= r.bottom);

            // Replay the relative steps and confirm they actually sum to the
            // reported target (i.e. the deltas are internally consistent).
            let mut x = 100.0_f64;
            let mut y = 100.0_f64;
            for step in &traj.steps {
                x += step.dx as f64;
                y += step.dy as f64;
            }
            assert!((x - traj.target_x).abs() < 1.0, "seed {seed}: x drift");
            assert!((y - traj.target_y).abs() < 1.0, "seed {seed}: y drift");
        }
    }

    #[test]
    fn longer_distance_takes_more_steps_fitts_law() {
        let near = rect(110.0, 100.0, 130.0, 120.0);
        let far = rect(2000.0, 1500.0, 2020.0, 1520.0);
        let short = synthesize(100.0, 100.0, near, Some(1));
        let long = synthesize(100.0, 100.0, far, Some(1));
        assert!(long.steps.len() > short.steps.len());
    }

    #[test]
    fn step_timing_stays_within_configured_bounds() {
        let r = rect(300.0, 300.0, 340.0, 330.0);
        let traj = synthesize(0.0, 0.0, r, Some(42));
        for step in &traj.steps {
            assert!(step.dt >= MIN_STEP_DT - 1e-9 && step.dt <= MAX_STEP_DT + 1e-9);
        }
    }

    #[test]
    fn zero_distance_move_still_produces_a_valid_trajectory() {
        let r = rect(100.0, 100.0, 104.0, 104.0);
        let traj = synthesize(102.0, 102.0, r, Some(7));
        assert!(traj.target_x >= r.left && traj.target_x <= r.right);
    }
}

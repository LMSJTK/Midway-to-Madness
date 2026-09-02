export const GAME_CONFIG = {
  CANVAS_WIDTH: 1600,
  CANVAS_HEIGHT: 1200,
  MAP_WIDTH: 1600,
  MAP_HEIGHT: 1200,

  /** Logical units a guest walks per second of simulated time at 1x. */
  WALK_SPEED: 60,
  /** Staff move a little faster than guests so repairs don't lag the day. */
  STAFF_SPEED: 70,

  /** Real seconds per in-game hour at 1x. A 8am-10pm day is 14 * this. */
  TIME_SCALE: 12,
  DAY_START: 8,
  DAY_END: 22,
  /** Guests stop arriving an hour before closing. */
  LAST_ARRIVAL: 21,

  ISO_OFFSET_X: 800,
  ISO_OFFSET_Y: 200,

  /**
   * Logical units per footprint grid cell. One cell projects to a diamond
   * TILE_HALF_W * 2 wide and TILE_HALF_H * 2 tall, because toIso maps
   * (x, y) to (x - y, (x + y) * 0.5).
   */
  CELL: 50,
  TILE_HALF_W: 50,
  TILE_HALF_H: 25,

  ENTRANCE_X: 800,
  ENTRANCE_Y: 1200,
};

/** Real seconds one full operating day takes at 1x speed. */
export const DAY_LENGTH_SECONDS =
  (GAME_CONFIG.DAY_END - GAME_CONFIG.DAY_START) * GAME_CONFIG.TIME_SCALE;

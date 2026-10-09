/**
 * Main Entry Point
 * Boots up the Target Shooter Game Engine when DOM is ready.
 */

import { GameEngine } from './engine/GameEngine.js';

window.addEventListener('DOMContentLoaded', () => {
  const engine = new GameEngine();
  engine.start();
  window.__GAME_ENGINE__ = engine; // Exposed for debugging / verification
});
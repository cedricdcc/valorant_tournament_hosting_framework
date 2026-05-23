import test from 'node:test';
import assert from 'node:assert/strict';
import type { StoreRegistry } from '@sapphire/pieces';
import { registerPieceDirectories, TournamentBotClient } from '../src/bot-client.js';

test('registerPieceDirectories maps commands, preconditions, and listeners from root path', () => {
  const registeredPaths: string[] = [];
  const stores = {
    registerPath(path: string) {
      registeredPaths.push(path);
      return this;
    },
  } as unknown as StoreRegistry;

  registerPieceDirectories(stores, '/srv/discord-bot/src', ['commands', 'preconditions', 'listeners']);

  assert.deepEqual(registeredPaths, [
    '/srv/discord-bot/src/commands',
    '/srv/discord-bot/src/preconditions',
    '/srv/discord-bot/src/listeners',
  ]);
});

test('TournamentBotClient applies constructor plugins', () => {
  let pluginCalled = false;

  const client = new TournamentBotClient({
    rootDirectory: '/srv/discord-bot/src',
    pieceDirectories: [],
    plugins: [
      () => {
        pluginCalled = true;
      },
    ],
  });

  assert.equal(pluginCalled, true);
  client.destroy();
});

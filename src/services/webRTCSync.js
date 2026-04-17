/**
 * WebRTC P2P Sync — Direct device-to-device sync via LAN/local network
 *
 * Uses y-webrtc for peer-to-peer sync when devices are on same network
 * Falls back to server sync when no peers available
 */

import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';

// ──── WebRTC Provider Manager ────

const _providers = new Map();

/**
 * Create a WebRTC P2P provider for a Yjs document
 * @param {object} params
 * @param {Y.Doc} params.doc - Yjs document
 * @param {string} params.room - Room name (shared across peers)
 * @param {string[]} [params.signaling] - Signaling servers
 * @param {Function} [params.onPeerConnected] - Peer connected callback
 * @param {Function} [params.onPeerDisconnected] - Peer disconnected callback
 * @returns {WebrtcProvider}
 */
export function createWebRTCProvider(params) {
  const { doc, room, signaling, onPeerConnected, onPeerDisconnected } = params;

  // Use default signaling if none provided
  const signalingServers = signaling || [
    'wss://webrtc.yjs.dev', // Default y-webrtc signaling
  ];

  const provider = new WebrtcProvider(room, doc, {
    signaling: signalingServers,
    password: undefined, // Optional room password
  });

  // Track peer connections
  if (onPeerConnected) {
    provider.on('peers', ({ added, removed }) => {
      for (const peer of added) {
        onPeerConnected({ peerId: peer, room });
      }
      for (const peer of removed) {
        onPeerDisconnected?.({ peerId: peer, room });
      }
    });
  }

  _providers.set(room, { provider, doc, room });

  return provider;
}

/**
 * Get current peer info for a room
 * @param {string} room
 * @returns {object|null}
 */
export function getWebRTCStatus(room) {
  const entry = _providers.get(room);
  if (!entry) return null;

  return {
    room,
    connected: entry.provider.connected,
    peerCount: entry.provider.webrtcConns.size,
    peers: Array.from(entry.provider.webrtcConns.keys()),
  };
}

/**
 * Destroy WebRTC provider for a room
 * @param {string} room
 */
export function destroyWebRTCProvider(room) {
  const entry = _providers.get(room);
  if (entry) {
    entry.provider.destroy();
    _providers.delete(room);
  }
}

/**
 * Get all active WebRTC rooms
 * @returns {Array}
 */
export function getActiveRooms() {
  return Array.from(_providers.entries()).map(([room, entry]) => ({
    room,
    peerCount: entry.provider.webrtcConns.size,
    peers: Array.from(entry.provider.webrtcConns.keys()),
  }));
}

/**
 * Check if P2P sync is available (any peers connected)
 * @param {string} room
 * @returns {boolean}
 */
export function hasPeers(room) {
  const entry = _providers.get(room);
  return entry ? entry.provider.webrtcConns.size > 0 : false;
}

export default {
  createWebRTCProvider,
  getWebRTCStatus,
  destroyWebRTCProvider,
  getActiveRooms,
  hasPeers,
};

/**
 * Peer-to-Peer Communication Network for Edge Robot Agents
 * Simulates real decentralized wireless exchange of intent and state packets.
 */

import { RobotMessage } from '../../shared/types.ts';

export interface NetworkListener {
  onMessageReceived(message: RobotMessage): void;
}

export class P2PNetwork {
  private listeners: Map<string, NetworkListener> = new Map();
  private disconnectedAgents: Set<string> = new Set();
  private messageHistory: RobotMessage[] = [];
  private maxHistory: number = 100;

  public registerAgent(agentId: string, listener: NetworkListener): void {
    this.listeners.set(agentId, listener);
  }

  public unregisterAgent(agentId: string): void {
    this.listeners.delete(agentId);
    this.disconnectedAgents.delete(agentId);
  }

  public setAgentCommunication(agentId: string, connected: boolean): void {
    if (connected) {
      this.disconnectedAgents.delete(agentId);
    } else {
      this.disconnectedAgents.add(agentId);
    }
  }

  public isAgentConnected(agentId: string): boolean {
    return !this.disconnectedAgents.has(agentId);
  }

  /**
   * Broadcasts an intent packet from an agent to all other active peers.
   */
  public broadcast(message: RobotMessage): void {
    // If sender is disconnected, message cannot be transmitted
    if (this.disconnectedAgents.has(message.sender_id)) {
      return;
    }

    // Keep history for inspection & debugging
    this.messageHistory.unshift(message);
    if (this.messageHistory.length > this.maxHistory) {
      this.messageHistory.pop();
    }

    // Deliver to all connected peers
    for (const [peerId, listener] of this.listeners.entries()) {
      if (peerId === message.sender_id) continue;
      // If peer is disconnected, packet is not received
      if (this.disconnectedAgents.has(peerId)) continue;

      listener.onMessageReceived(message);
    }
  }

  public getRecentMessages(limit: number = 20): RobotMessage[] {
    return this.messageHistory.slice(0, limit);
  }

  public clearHistory(): void {
    this.messageHistory = [];
  }
}

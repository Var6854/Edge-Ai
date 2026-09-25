/**
 * Warehouse Grid Model for Edge-AI AMR Fleet Simulation
 * 30 x 20 Grid with Shelves, Aisles, Stations, and Intersections
 */

import { Position, Station, WarehouseConfig } from '../../shared/types.ts';

export class Warehouse {
  public width: number = 30;
  public height: number = 20;

  // Set of blocked cells: "x,y"
  public shelvesSet: Set<string> = new Set();
  public blockedAislesSet: Set<string> = new Set();
  
  public pickupStations: Station[] = [];
  public deliveryStations: Station[] = [];
  public chargingStations: Station[] = [];
  public intersections: Position[] = [];

  constructor(width: number = 30, height: number = 20) {
    this.width = width;
    this.height = height;
    this.initializeDefaultLayout();
  }

  /**
   * Initializes a realistic 30x20 warehouse grid:
   * - Top perimeter (y=0..1) has pickup stations P1, P2, P3, P4
   * - Bottom perimeter (y=18..19) has delivery stations D1, D2, D3, D4
   * - Left/Right margins (x=1..2, y=9..11) have charging stations C1, C2, C3
   * - Central area features 4 large shelf rack blocks with cross-aisles
   * - Major arterial intersections at key choke points
   */
  public initializeDefaultLayout(): void {
    this.shelvesSet.clear();
    this.blockedAislesSet.clear();

    // Shelf Blocks:
    // Block 1: x: 4..8, y: 3..7
    // Block 2: x: 12..16, y: 3..7
    // Block 3: x: 20..24, y: 3..7
    // Block 4: x: 4..8, y: 11..15
    // Block 5: x: 12..16, y: 11..15
    // Block 6: x: 20..24, y: 11..15
    const shelfRacks = [
      { x1: 5, x2: 9, y1: 3, y2: 7 },
      { x1: 13, x2: 17, y1: 3, y2: 7 },
      { x1: 21, x2: 25, y1: 3, y2: 7 },
      { x1: 5, x2: 9, y1: 11, y2: 15 },
      { x1: 13, x2: 17, y1: 11, y2: 15 },
      { x1: 21, x2: 25, y1: 11, y2: 15 },
    ];

    for (const rack of shelfRacks) {
      for (let x = rack.x1; x <= rack.x2; x++) {
        for (let y = rack.y1; y <= rack.y2; y++) {
          // Leave occasional access slots in the rack if desired, or solid racks
          this.shelvesSet.add(`${x},${y}`);
        }
      }
    }

    // Pickup Stations along northern logistics apron (y = 1)
    this.pickupStations = [
      { id: 'P1', name: 'Pickup Station A (Inbound Dock 1)', position: [3, 1], type: 'PICKUP' },
      { id: 'P2', name: 'Pickup Station B (Inbound Dock 2)', position: [11, 1], type: 'PICKUP' },
      { id: 'P3', name: 'Pickup Station C (Inbound Dock 3)', position: [19, 1], type: 'PICKUP' },
      { id: 'P4', name: 'Pickup Station D (Kitting Staging)', position: [27, 1], type: 'PICKUP' },
    ];

    // Delivery Stations along southern packing/outbound apron (y = 18)
    this.deliveryStations = [
      { id: 'D1', name: 'Delivery Station 1 (Packing Line A)', position: [3, 18], type: 'DELIVERY' },
      { id: 'D2', name: 'Delivery Station 2 (Packing Line B)', position: [11, 18], type: 'DELIVERY' },
      { id: 'D3', name: 'Delivery Station 3 (Palletizer 1)', position: [19, 18], type: 'DELIVERY' },
      { id: 'D4', name: 'Delivery Station 4 (Outbound Staging)', position: [27, 18], type: 'DELIVERY' },
    ];

    // Charging Stations
    this.chargingStations = [
      { id: 'C1', name: 'Fast Charger 1', position: [1, 9], type: 'CHARGING' },
      { id: 'C2', name: 'Fast Charger 2', position: [1, 10], type: 'CHARGING' },
      { id: 'C3', name: 'Overnight Depot Charger', position: [28, 9], type: 'CHARGING' },
    ];

    // Arterial intersections at main crossway (y = 9) and vertical avenues (x = 3, 11, 19, 27)
    this.intersections = [
      [3, 9],
      [11, 9],
      [19, 9],
      [27, 9],
      [11, 2],
      [19, 2],
      [11, 16],
      [19, 16],
    ];
  }

  public isTraversable(x: number, y: number, allowStation: boolean = true): boolean {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return false;
    }
    const key = `${x},${y}`;
    if (this.shelvesSet.has(key)) return false;
    if (this.blockedAislesSet.has(key)) return false;
    return true;
  }

  public toggleAisleBlock(x: number, y: number): boolean {
    const key = `${x},${y}`;
    // Cannot block shelf or station
    if (this.shelvesSet.has(key)) return false;
    
    if (this.blockedAislesSet.has(key)) {
      this.blockedAislesSet.delete(key);
      return false; // Now unblocked
    } else {
      this.blockedAislesSet.add(key);
      return true; // Now blocked
    }
  }

  public setAisleBlocked(x: number, y: number, blocked: boolean): void {
    const key = `${x},${y}`;
    if (this.shelvesSet.has(key)) return;
    if (blocked) {
      this.blockedAislesSet.add(key);
    } else {
      this.blockedAislesSet.delete(key);
    }
  }

  public getNeighbors(pos: Position): Position[] {
    const [x, y] = pos;
    const candidates: Position[] = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ];
    return candidates.filter(([nx, ny]) => this.isTraversable(nx, ny));
  }

  public toConfig(): WarehouseConfig {
    const shelves: Position[] = Array.from(this.shelvesSet).map((k) => {
      const [x, y] = k.split(',').map(Number);
      return [x, y];
    });
    const blockedCells: Position[] = Array.from(this.blockedAislesSet).map((k) => {
      const [x, y] = k.split(',').map(Number);
      return [x, y];
    });

    return {
      width: this.width,
      height: this.height,
      shelves,
      pickupStations: this.pickupStations,
      deliveryStations: this.deliveryStations,
      chargingStations: this.chargingStations,
      blockedCells,
      intersectionCells: this.intersections,
    };
  }
}

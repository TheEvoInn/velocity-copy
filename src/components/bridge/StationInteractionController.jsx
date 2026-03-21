import * as THREE from 'three';

class StationInteractionController {
  constructor(stations, camera, renderer) {
    this.stations = stations;
    this.camera = camera;
    this.renderer = renderer;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.focusedStation = null;
    this.interactionCallbacks = {};
    this.povController = null;
  }

  setPOVController(povController) {
    this.povController = povController;
  }

  registerCallback(event, callback) {
    if (!this.interactionCallbacks[event]) {
      this.interactionCallbacks[event] = [];
    }
    this.interactionCallbacks[event].push(callback);
  }

  fireCallback(event, data) {
    if (this.interactionCallbacks[event]) {
      this.interactionCallbacks[event].forEach(cb => cb(data));
    }
  }

  handleMouseMove(event) {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  }

  handleClick(event) {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(
      this.stations.map(s => s.mesh)
    );

    if (intersects.length > 0) {
      const clickedMesh = intersects[0].object;
      const station = this.stations.find(s => s.mesh === clickedMesh);
      
      if (station) {
        this.focusStation(station);
      }
    } else if (this.focusedStation) {
      this.unfocusStation();
    }
  }

  handleKeyPress(event) {
    if (event.key === 'Escape' && this.focusedStation) {
      this.unfocusStation();
    }
  }

  focusStation(station) {
    if (this.focusedStation === station) {
      // Double-click to enter inspection mode
      if (this.povController) {
        this.povController.startInspectionMode(station.mesh);
      }
      return;
    }
    
    this.focusedStation = station;
    this.fireCallback('station:focused', {
      station: station.name,
      color: station.color,
      mesh: station.mesh
    });
  }

  unfocusStation() {
    if (!this.focusedStation) return;
    
    const prevStation = this.focusedStation;
    this.focusedStation = null;
    
    if (this.povController && this.povController.inspectionMode) {
      this.povController.exitInspectionMode();
    }
    
    this.fireCallback('station:unfocused', {
      station: prevStation.name
    });
  }

  getHoveredStation() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(
      this.stations.map(s => s.mesh)
    );

    if (intersects.length > 0) {
      const mesh = intersects[0].object;
      return this.stations.find(s => s.mesh === mesh);
    }
    return null;
  }
}

export default StationInteractionController;
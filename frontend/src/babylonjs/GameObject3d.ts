import * as BABYLON from "@babylonjs/core";

// =====================================
// GAME OBJECT 3D WRAPPER
// =====================================
export class GameObject3D {
	constructor(
		public mesh: BABYLON.AbstractMesh,
		public type: 'paddle' | 'ball' | 'wall'
	) {}

	get position(): BABYLON.Vector3 {
		return this.mesh.position;
	}

	set position(pos: BABYLON.Vector3) {
		this.mesh.position.copyFrom(pos);
	}

	getBounds(): BABYLON.BoundingBox {
		this.mesh.computeWorldMatrix(true);
		this.mesh.getBoundingInfo().update(this.mesh.getWorldMatrix());
		return this.mesh.getBoundingInfo().boundingBox;
	}

	update(deltaTime: number): void {
		// Any per-frame updates for this object
	}
}
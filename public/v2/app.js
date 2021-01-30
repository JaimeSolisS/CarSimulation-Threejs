class App {
    constructor() {
        this.init();

    }

    init() {
        //CREATE SCENE
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0, 0, 0); //Set background to black

        //CREATE CAMERA
        this.camera = new THREE.PerspectiveCamera(100, window.innerWidth / window.innerHeight, 0.1, 2000);
        this.camera.position.set(0, 3, 10);

        // LIGHTS
        const ambient = new THREE.AmbientLight("rgb(136,136,136)");
        this.scene.add(ambient);
        const light = new THREE.DirectionalLight("rgb(221,221,221)");
        light.position.set(3, 10, 4);
        light.target.position.set(0, 0, 0);
        this.scene.add(light);

        //CREATE RENDERER
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        this.helper = new Auxiliar(this.scene);
        this.fixedTimeStep = 1.0 / 60.0;

        this.initWorld();
    }


    initWorld() {
        const app = this;

        const world = new CANNON.World(); //Nothing works in Cannon with out a world
        this.world = world; //make world an app property

        world.broadphase = new CANNON.NaiveBroadphase(); //Collision detection
        world.gravity.set(0, -10, 0); //WebGL orientation gravity on Y axis
        world.defaultContactMaterial.friction = 0;

        //GROUND MATERIAL
        const groundMaterial = new CANNON.Material("groundMaterial");
        const wheelMaterial = new CANNON.Material("wheelMaterial");
        const wheelGroundContactMaterial = new CANNON.ContactMaterial(wheelMaterial, groundMaterial, {
            friction: .3,
            restitution: 0,
            contactEquationStiffness: 1000
        });

        // We must add the contact materials to the world
        world.addContactMaterial(wheelGroundContactMaterial);

        //CAR SHAPE
        const carShape = new CANNON.Box(new CANNON.Vec3(1, .5, 2));
        const carBody = new CANNON.Body({ mass: 150, material: groundMaterial });
        carBody.addShape(carShape);
        carBody.position.set(0, 4, 0);
        this.helper.addVisual(carBody, 'car');

        //CAR OBJECT
        const vehicle = new CANNON.RaycastVehicle({
            chassisBody: carBody,
            indexRightAxis: 0,
            indexUpAxis: 1,
            indexForwardAxis: 2,
        });

        //WHEELS ->Code from cannon.js
        const options = {
            radius: .5,
            directionLocal: new CANNON.Vec3(0, -1, 0),
            suspensionStiffness: 30,
            suspensionRestLength: 0.3,
            frictionSlip: 5,
            dampingRelaxation: 2.3,
            dampingCompression: 4.4,
            maxSuspensionForce: 100000,
            rollInfluence: 0.01,
            axleLocal: new CANNON.Vec3(-1, 0, 0),
            chassisConnectionPointLocal: new CANNON.Vec3(1, 1, 0),
            maxSuspensionTravel: 0.3,
            customSlidingRotationalSpeed: -30,
            useCustomSlidingRotationalSpeed: true
        };

        //WHEELS POSITION
        options.chassisConnectionPointLocal.set(1, 0, -1);
        vehicle.addWheel(options);
        options.chassisConnectionPointLocal.set(-1, 0, -1);
        vehicle.addWheel(options);
        options.chassisConnectionPointLocal.set(1, 0, 1);
        vehicle.addWheel(options);
        options.chassisConnectionPointLocal.set(-1, 0, 1);
        vehicle.addWheel(options);

        vehicle.addToWorld(world);

        //CANNON functions ->Code from cannon.js
        const wheelBodies = [];
        vehicle.wheelInfos.forEach(function(wheel) {
            const cylinderShape = new CANNON.Cylinder(wheel.radius, wheel.radius, wheel.radius / 2, 20);
            const wheelBody = new CANNON.Body({ mass: 1, material: wheelMaterial });
            const q = new CANNON.Quaternion();
            q.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI / 2);
            wheelBody.addShape(cylinderShape, new CANNON.Vec3(), q);
            wheelBodies.push(wheelBody);
            app.helper.addVisual(wheelBody, 'wheel');
        });

        // Update wheels ->Code from cannon.js
        world.addEventListener('postStep', function() {
            let index = 0;
            app.vehicle.wheelInfos.forEach(function(wheel) {
                app.vehicle.updateWheelTransform(index);
                const t = wheel.worldTransform;
                wheelBodies[index].threemesh.position.copy(t.position);
                wheelBodies[index].threemesh.quaternion.copy(t.quaternion);
                index++;
            });
        });

        this.vehicle = vehicle;

        //GROUND
        const groundShape = new CANNON.Plane(); //Flat Horizontal plane
        const groundBody = new CANNON.Body({ mass: 0, material: groundMaterial }); //mass of O means that it will be static. 
        groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2); //rotate around x axis 90 degrees
        groundBody.addShape(groundShape);
        world.add(groundBody);
        this.helper.addVisual(groundBody, 'ground', false, true);
        this.groundMaterial = groundMaterial; //ground material is an app property


        this.animate();
    }

    moveCar() {
        const self = this;
        document.addEventListener('keydown', function(event) {

            var maxSteerVal = .5;
            var maxForce = 1000;
            var breakForce = 10;

            var up = (event.type == 'keyup');
            if (!up && event.type !== 'keydown') {
                return;
            }

            self.vehicle.setBrake(0, 0);
            self.vehicle.setBrake(0, 1);
            self.vehicle.setBrake(0, 3);
            self.vehicle.setBrake(0, 2);

            if (event.key) {
                switch (event.key) {

                    case "ArrowUp": // forward
                        self.vehicle.applyEngineForce(up ? 0 : -maxForce, 2);
                        self.vehicle.applyEngineForce(up ? 0 : -maxForce, 3);
                        break;

                    case "ArrowDown": // backward
                        self.vehicle.applyEngineForce(up ? 0 : maxForce, 2);
                        self.vehicle.applyEngineForce(up ? 0 : maxForce, 3);
                        break;

                    case " ": //b
                        self.vehicle.setBrake(breakForce, 0);
                        self.vehicle.setBrake(breakForce, 1);
                        self.vehicle.setBrake(breakForce, 2);
                        self.vehicle.setBrake(breakForce, 3);
                        break;
                    case "ArrowRight": // right
                        self.vehicle.setSteeringValue(up ? 0 : -maxSteerVal, 0);
                        self.vehicle.setSteeringValue(up ? 0 : -maxSteerVal, 1);
                        break;
                    case "ArrowLeft": // left
                        self.vehicle.setSteeringValue(up ? 0 : maxSteerVal, 0);
                        self.vehicle.setSteeringValue(up ? 0 : maxSteerVal, 1);
                        break;

                }
            }


        });
    }

    animate() {
        const app = this;
        requestAnimationFrame(function() {
            app.animate();
        });

        this.world.step(this.fixedTimeStep);

        this.updateBodies(this.world);
        this.moveCar();

        this.renderer.render(this.scene, this.camera);
    }

    updateBodies(world) {
        world.bodies.forEach(function(body) {
            if (body.threemesh != undefined) {
                body.threemesh.position.copy(body.position);
                body.threemesh.quaternion.copy(body.quaternion);
            }
        });
    }
}

//Functions from cannon.demo.js library ->Still trying to figure it out how they work
class Auxiliar {
    constructor(scene) {
        this.scene = scene;
    }

    //Default Settings to construct an object I guess
    addVisual(body, name, castShadow = true, receiveShadow = true) {
        body.name = name;
        if (this.currentMaterial === undefined) this.currentMaterial = new THREE.MeshLambertMaterial({ color: 0x888888 });
        if (this.settings === undefined) {
            this.settings = {
                stepFrequency: 60,
                quatNormalizeSkip: 2,
                quatNormalizeFast: true,
                gx: 0,
                gy: 0,
                gz: 0,
                iterations: 3,
                tolerance: 0.0001,
                k: 1e6,
                d: 3,
                scene: 0,
                paused: false,
                rendermode: "solid",
                constraints: false,
                contacts: false, // Contact points
                cm2contact: false, // center of mass to contact points
                normals: false, // contact normals
                axes: false, // "local" frame axes
                particleSize: 0.1,
                shadows: false,
                aabbs: false,
                profiling: false,
                maxSubSteps: 3
            }
            this.particleGeo = new THREE.SphereGeometry(1, 16, 8);
            this.particleMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000 });
        }
        // What geometry should be used?
        let mesh;
        if (body instanceof CANNON.Body) mesh = this.shape2Mesh(body, castShadow, receiveShadow);

        if (mesh) {
            // Add body
            body.threemesh = mesh;
            mesh.castShadow = castShadow;
            mesh.receiveShadow = receiveShadow;
            this.scene.add(mesh);
        }
    }

    shape2Mesh(body, castShadow, receiveShadow) {
        const obj = new THREE.Object3D();
        const material = this.currentMaterial;
        const app = this;
        let index = 0;

        body.shapes.forEach(function(shape) {
            let mesh;
            let geometry;
            let v0, v1, v2;

            switch (shape.type) {

                case CANNON.Shape.types.SPHERE:
                    const sphere_geometry = new THREE.SphereGeometry(shape.radius, 8, 8);
                    mesh = new THREE.Mesh(sphere_geometry, material);
                    break;

                case CANNON.Shape.types.PARTICLE:
                    mesh = new THREE.Mesh(app.particleGeo, app.particleMaterial);
                    const s = this.settings;
                    mesh.scale.set(s.particleSize, s.particleSize, s.particleSize);
                    break;

                case CANNON.Shape.types.PLANE:
                    geometry = new THREE.PlaneGeometry(10, 10, 4, 4);
                    mesh = new THREE.Object3D();
                    const submesh = new THREE.Object3D();
                    const ground = new THREE.Mesh(geometry, material);
                    ground.scale.set(100, 100, 100);
                    submesh.add(ground);

                    mesh.add(submesh);
                    break;

                case CANNON.Shape.types.BOX:
                    const box_geometry = new THREE.BoxGeometry(shape.halfExtents.x * 2,
                        shape.halfExtents.y * 2,
                        shape.halfExtents.z * 2);
                    mesh = new THREE.Mesh(box_geometry, material);
                    break;

                case CANNON.Shape.types.CONVEXPOLYHEDRON:
                    const geo = new THREE.Geometry();

                    // Add vertices
                    shape.vertices.forEach(function(v) {
                        geo.vertices.push(new THREE.Vector3(v.x, v.y, v.z));
                    });

                    shape.faces.forEach(function(face) {
                        // add triangles
                        const a = face[0];
                        for (let j = 1; j < face.length - 1; j++) {
                            const b = face[j];
                            const c = face[j + 1];
                            geo.faces.push(new THREE.Face3(a, b, c));
                        }
                    });
                    geo.computeBoundingSphere();
                    geo.computeFaceNormals();
                    mesh = new THREE.Mesh(geo, material);
                    break;

                case CANNON.Shape.types.HEIGHTFIELD:
                    geometry = new THREE.Geometry();

                    v0 = new CANNON.Vec3();
                    v1 = new CANNON.Vec3();
                    v2 = new CANNON.Vec3();
                    for (let xi = 0; xi < shape.data.length - 1; xi++) {
                        for (let yi = 0; yi < shape.data[xi].length - 1; yi++) {
                            for (let k = 0; k < 2; k++) {
                                shape.getConvexTrianglePillar(xi, yi, k === 0);
                                v0.copy(shape.pillarConvex.vertices[0]);
                                v1.copy(shape.pillarConvex.vertices[1]);
                                v2.copy(shape.pillarConvex.vertices[2]);
                                v0.vadd(shape.pillarOffset, v0);
                                v1.vadd(shape.pillarOffset, v1);
                                v2.vadd(shape.pillarOffset, v2);
                                geometry.vertices.push(
                                    new THREE.Vector3(v0.x, v0.y, v0.z),
                                    new THREE.Vector3(v1.x, v1.y, v1.z),
                                    new THREE.Vector3(v2.x, v2.y, v2.z)
                                );
                                var i = geometry.vertices.length - 3;
                                geometry.faces.push(new THREE.Face3(i, i + 1, i + 2));
                            }
                        }
                    }
                    geometry.computeBoundingSphere();
                    geometry.computeFaceNormals();
                    mesh = new THREE.Mesh(geometry, material);
                    break;

                case CANNON.Shape.types.TRIMESH:
                    geometry = new THREE.Geometry();

                    v0 = new CANNON.Vec3();
                    v1 = new CANNON.Vec3();
                    v2 = new CANNON.Vec3();
                    for (let i = 0; i < shape.indices.length / 3; i++) {
                        shape.getTriangleVertices(i, v0, v1, v2);
                        geometry.vertices.push(
                            new THREE.Vector3(v0.x, v0.y, v0.z),
                            new THREE.Vector3(v1.x, v1.y, v1.z),
                            new THREE.Vector3(v2.x, v2.y, v2.z)
                        );
                        var j = geometry.vertices.length - 3;
                        geometry.faces.push(new THREE.Face3(j, j + 1, j + 2));
                    }
                    geometry.computeBoundingSphere();
                    geometry.computeFaceNormals();
                    mesh = new THREE.Mesh(geometry, MutationRecordaterial);
                    break;

                default:
                    throw "Visual type not recognized: " + shape.type;
            }

            mesh.receiveShadow = receiveShadow;
            mesh.castShadow = castShadow;

            mesh.traverse(function(child) {
                if (child.isMesh) {
                    child.castShadow = castShadow;
                    child.receiveShadow = receiveShadow;
                }
            });

            var o = body.shapeOffsets[index];
            var q = body.shapeOrientations[index++];
            mesh.position.set(o.x, o.y, o.z);
            mesh.quaternion.set(q.x, q.y, q.z, q.w);

            obj.add(mesh);
        });

        return obj;
    }


}
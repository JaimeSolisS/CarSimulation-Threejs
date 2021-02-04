class App {
    constructor() {

        this.fixedTimeStep = 1.0 / 60.0;
        const app = this;

        const options = {
            assets: [
                "../assets/textures/nx.png",
                "../assets/textures/px.png",
                "../assets/textures/ny.png",
                "../assets/textures/py.png",
                "../assets/textures/nz.png",
                "../assets/textures/pz.png"
            ],
            oncomplete: function() {
                app.init();
                app.animate();
            }
        }

        const preloader = new Preloader(options);
    }

    init() {

        //CREATE CAMERA
        this.camera = new THREE.PerspectiveCamera(100, window.innerWidth / window.innerHeight, 1, 100000);
        this.camera.position.set(0, 5, -40);

        //CREATE SCENE
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color('rgb(0,0,0)');

        // LIGHTS
        const ambient = new THREE.AmbientLight('rgb(136,136,136)');
        this.scene.add(ambient);

        const light = new THREE.DirectionalLight('rgb(221,221,221)');
        light.position.set(30, 100, 40);
        light.target.position.set(0, 0, 0);

        light.castShadow = true;

        const lightSize = 30;
        light.shadow.camera.near = 1;
        light.shadow.camera.far = 500;
        light.shadow.camera.left = light.shadow.camera.bottom = -lightSize;
        light.shadow.camera.right = light.shadow.camera.top = lightSize;

        light.shadow.bias = 0.0039;
        light.shadow.mapSize.width = 1024;
        light.shadow.mapSize.height = 1024;

        this.sun = light;
        this.scene.add(light);

        //CREATE RENDERER
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);
        this.renderer.shadowMap.enabled = true;

        //this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        //this.controls.enableZoom = true;
        //this.controls.enablePan = true;

        this.loadAssets();
        this.helper = new Auxiliar(this.scene);

    }

    loadAssets() {
        const app = this;
        const loader = new THREE.FBXLoader();

        loader.load('../assets/cityCar.fbx',
            function(object) {
                let material, map, index, maps;
                const euler = new THREE.Euler();


                object.traverse(function(child) { //loop through all children
                    let receiveShadow = true;
                    if (child.isMesh) {
                        if (child.name == "car") {
                            app.car = { chassis: child };
                            app.followCam = new THREE.Object3D();
                            app.followCam.position.copy(app.camera.position);
                            app.scene.add(app.followCam)
                            app.followCam.parent = child;
                            app.sun.target = child; //light for car objetc
                            child.castShadow = true;
                            receiveShadow = false;
                        }

                        child.receiveShadow = receiveShadow;
                    }
                });

                app.assets = object;
                app.scene.add(object);

                app.initPhysics();
            },
            null,
            function(error) {
                console.error(error);
            }
        );
    }

    initPhysics() {
        this.physics = {};

        const app = this;
        const mass = 150;
        const world = new CANNON.World();
        this.world = world;

        world.broadphase = new CANNON.SAPBroadphase(world);
        world.gravity.set(0, -10, 0);
        world.defaultContactMaterial.friction = 0;

        const groundMaterial = new CANNON.Material("groundMaterial");
        const wheelMaterial = new CANNON.Material("wheelMaterial");
        const wheelGroundContactMaterial = new CANNON.ContactMaterial(wheelMaterial, groundMaterial, {
            friction: 0.3,
            restitution: 0,
            contactEquationStiffness: 1000
        });

        // We must add the contact materials to the world
        world.addContactMaterial(wheelGroundContactMaterial);

        const chassisShape = new CANNON.Box(new CANNON.Vec3(8, 4, 16));
        const chassisBody = new CANNON.Body({ mass: mass });
        const pos = this.car.chassis.position.clone();
        //pos.y += 1;
        chassisBody.addShape(chassisShape);
        chassisBody.position.copy(pos);
        chassisBody.angularVelocity.set(0, 0, 0);
        //chassisBody.threemesh = this.car.chassis;
        this.helper.addVisual(chassisBody, 'car');

        const options = {
            radius: 10,
            directionLocal: new CANNON.Vec3(0, -1, 0),
            suspensionStiffness: 45,
            suspensionRestLength: 0.4,
            frictionSlip: 5,
            dampingRelaxation: 2.3,
            dampingCompression: 4.5,
            maxSuspensionForce: 200000,
            rollInfluence: 0.01,
            axleLocal: new CANNON.Vec3(-1, 0, 0),
            chassisConnectionPointLocal: new CANNON.Vec3(1, 1, 0),
            maxSuspensionTravel: 0.25,
            customSlidingRotationalSpeed: -30,
            useCustomSlidingRotationalSpeed: true
        };

        // Create the vehicle
        const vehicle = new CANNON.RaycastVehicle({
            chassisBody: chassisBody,
            indexRightAxis: 0,
            indexUpAxis: 1,
            indexForwardAxis: 2
        });

        const axlewidth = 16;
        options.chassisConnectionPointLocal.set(axlewidth, 0, -16);
        vehicle.addWheel(options);

        options.chassisConnectionPointLocal.set(-axlewidth, 0, -16);
        vehicle.addWheel(options);

        options.chassisConnectionPointLocal.set(axlewidth, 0, 16);
        vehicle.addWheel(options);

        options.chassisConnectionPointLocal.set(-axlewidth, 0, 16);
        vehicle.addWheel(options);

        vehicle.addToWorld(world);

        const wheelBodies = [];

        vehicle.wheelInfos.forEach(function(wheel) {
            const cylinderShape = new CANNON.Cylinder(wheel.radius, wheel.radius, wheel.radius / 2, 20);
            const wheelBody = new CANNON.Body({ mass: 1 });
            const q = new CANNON.Quaternion();
            q.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI / 2);
            wheelBody.addShape(cylinderShape, new CANNON.Vec3(), q);
            wheelBodies.push(wheelBody);
            app.helper.addVisual(wheelBody, 'wheel');
            //wheelBody.threemesh = wheels[index++];
        });
        app.car.wheels = wheelBodies;
        // Update wheels
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

    }

    moveCar() {
        const self = this;
        document.addEventListener('keydown', function(event) {

            var maxSteerVal = .5;
            var maxForce = 100000;
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

                    case " ": //brake
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

    updateCamera() {
        if (this.followCam === undefined) return;
        const pos = this.car.chassis.position.clone();
        pos.y += 0.3;
        if (this.controls !== undefined) {
            this.controls.target.copy(pos);
            this.controls.update();
        } else {
            this.camera.position.lerp(this.followCam.getWorldPosition(new THREE.Vector3()), 0.05);
            if (this.camera.position.y < 1) this.camera.position.y = 1;
            this.camera.lookAt(pos);
        }

        if (this.sun != undefined) {
            this.sun.position.copy(this.camera.position);
            this.sun.position.y += 10;
        }
    }

    animate() {
        const app = this;

        requestAnimationFrame(function() { app.animate(); });

        const now = Date.now();
        if (this.lastTime === undefined) this.lastTime = now;
        const dt = (Date.now() - this.lastTime) / 1000.0;
        this.FPSFactor = dt;
        this.lastTime = now;

        if (this.world !== undefined) {
            this.moveCar();
            this.car.chassis.position.copy(this.vehicle.chassisBody.position.clone());
            this.car.chassis.quaternion.copy(this.vehicle.chassisBody.quaternion.clone());

            this.world.step(this.fixedTimeStep, dt, 10);

            this.world.bodies.forEach(function(body) {
                if (body.threemesh != undefined) {
                    body.threemesh.position.copy(body.position);
                    body.threemesh.quaternion.copy(body.quaternion);
                    if (body == app.vehicle.chassisBody) {
                        const elements = body.threemesh.matrix.elements;
                        const yAxis = new THREE.Vector3(elements[4], elements[5], elements[6]);
                        body.threemesh.position.sub(yAxis.multiplyScalar(0.6));
                    }
                }
            });


        }
        this.updateCamera();
        this.renderer.render(this.scene, this.camera);

    }
}

class Preloader {
    constructor(options) {
        this.assets = {};
        for (let asset of options.assets) {
            this.assets[asset] = { loaded: 0, complete: false };
            this.load(asset);
        }
        this.container = options.container;
        if (options.onprogress == undefined) {
            this.onprogress = onprogress;
            this.domElement = document.createElement("div");
            this.domElement.style.position = 'absolute';
            this.domElement.style.top = '0';
            this.domElement.style.left = '0';
            this.domElement.style.width = '100%';
            this.domElement.style.height = '100%';
            this.domElement.style.background = '#000';
            this.domElement.style.opacity = '0.7';
            this.domElement.style.display = 'flex';
            this.domElement.style.alignItems = 'center';
            this.domElement.style.justifyContent = 'center';
            this.domElement.style.zIndex = '1111';
            const barBase = document.createElement("div");
            barBase.style.background = '#000';
            barBase.style.width = '50%';
            barBase.style.minWidth = '250px';
            barBase.style.borderRadius = '10px';
            barBase.style.height = '15px';
            this.domElement.appendChild(barBase);
            const bar = document.createElement("div");
            bar.style.background = '#2a2';
            bar.style.width = '50%';
            bar.style.borderRadius = '10px';
            bar.style.height = '100%';
            bar.style.width = '0';
            barBase.appendChild(bar);
            this.progressBar = bar;
            if (this.container != undefined) {
                this.container.appendChild(this.domElement);
            } else {
                document.body.appendChild(this.domElement);
            }
        } else {
            this.onprogress = options.onprogress;
        }

        this.oncomplete = options.oncomplete;

        const loader = this;

        function onprogress(delta) {
            const progress = delta * 100;
            loader.progressBar.style.width = `${progress}%`;
        }
    }



    checkCompleted() {
        for (let prop in this.assets) {
            const asset = this.assets[prop];
            if (!asset.complete) return false;
        }
        return true;
    }

    get progress() {
        let total = 0;
        let loaded = 0;

        for (let prop in this.assets) {
            const asset = this.assets[prop];
            if (asset.total == undefined) {
                loaded = 0;
                break;
            }
            loaded += asset.loaded;
            total += asset.total;
        }

        return loaded / total;

    }

    load(url) {
        const loader = this;
        var xobj = new XMLHttpRequest();
        xobj.overrideMimeType("application/json");
        xobj.open('GET', url, true);
        xobj.onreadystatechange = function() {
            if (xobj.readyState == 4 && xobj.status == "200") {
                loader.assets[url].complete = true;
                if (loader.checkCompleted()) {
                    if (loader.domElement != undefined) {
                        if (loader.container != undefined) {
                            loader.container.removeChild(loader.domElement);
                        } else {
                            document.body.removeChild(loader.domElement);
                        }
                    }
                    loader.oncomplete();
                }
            }
        };
        xobj.onprogress = function(e) {
            const asset = loader.assets[url];
            asset.loaded = e.loaded;
            asset.total = e.total;
            loader.onprogress(loader.progress);
        }
        xobj.send(null);
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
        // if (this.currentMaterial === undefined) this.currentMaterial = new THREE.MeshLambertMaterial({ color: 0x888888 });
        if (this.currentMaterial === undefined) this.currentMaterial = new THREE.MeshLambertMaterial({ color: 'rgb(0,0,0)' });
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
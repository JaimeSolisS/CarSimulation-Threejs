class App {
    constructor() {
        this.init();
    }

    init() {
        //CREATE SCENE
        this.scene = new THREE.Scene();

        //CREATE CAMERA
        this.camera = new THREE.PerspectiveCamera(100, window.innerWidth / window.innerHeight, 0.1, 100000);
        this.camera.position.set(300, 200, 500);

        //CREATE RENDERER
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        //SET LIGHTS
        const light = new THREE.DirectionalLight("rgb(255, 255, 255)");
        light.position.set(1000, 2000, 0);


        /* const directionalLightHelper = new THREE.DirectionalLightHelper(light);
         this.scene.add(directionalLightHelper);
         */

        const ambient = new THREE.AmbientLight("rgb(255, 255, 255)", 0.5);
        this.scene.add(light);
        this.scene.add(ambient);

        //SPIN CAMERA
        this.controls = new THREE.OrbitControls(this.camera);

        //LOADER
        const loader = new THREE.FBXLoader();
        const app = this;

        //load method (fbx file path, load method (what we want to do once the objetc is loaded), progress as it is downloaded, error)
        loader.load("../assets/cityCarV4.fbx", function(object) {
            app.car = object;
            app.scene.add(object);
            //camera moves with mouse control
            app.controls.target = object.position.clone();
            app.controls.update();

            object.traverse(function(child) {
                if (child.isMesh) {
                    child.castShadow = child.receiveShadow = true;
                }
            });
            app.animate();

        }, null, function(error) {
            console.error(error);
        })

        const tloader = new THREE.CubeTextureLoader();
        tloader.setPath('../assets/textures/');

        var textureCube = tloader.load([
            'px.jpg', 'nx.jpg',
            'py.jpg', 'ny.jpg',
            'pz.jpg', 'nz.jpg'
        ]);

        app.scene.background = textureCube;
    }

    animate() {
        const app = this;
        requestAnimationFrame(function() { app.animate(); });

        this.renderer.render(this.scene, this.camera);
    }
}
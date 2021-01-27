class App {
    //for every new App it runs the constructor code
    constructor() {

        //CREATE SCENE AND CAMERA
        this.scene = new THREE.Scene(); //everithing in Three library is preceed by three
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000); //With perspective camera objects in the distance will appear smaller than objects in the foreground
        //THREE.PerspectiveCamera(angle, aspect ratio, nearest point to render from camera, farthest.....) 

        //CREATE RENDERER
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement); //apend canvas to document body

        //CREATE LIGHT
        const light = new THREE.DirectionalLight("rgb(255, 255, 255)");
        light.position.set(0, 20, 10); //x,y,z
        const ambient = new THREE.AmbientLight("rgba(0, 112, 112, 0.44)"); // soft white light

        //CREATE GEOMETRY AND MATERIAL
        const geometry = new THREE.BoxGeometry(1, 1, 1); //x,y,z
        const material = new THREE.MeshPhongMaterial({ color: "rgb(0,170,255)" });

        //CREATE MESH
        this.cube = new THREE.Mesh(geometry, material);

        //ADD ELEMENTS TO SCENE
        this.scene.add(this.cube);
        this.scene.add(light);
        this.scene.add(ambient);

        this.camera.position.z = 3;

        this.animate();
    }

    animate() {
        const app = this;
        //Calling repeatedly this method
        requestAnimationFrame(function() { app.animate(); });

        this.cube.rotation.x += 0.01;
        this.cube.rotation.y += 0.01;

        this.renderer.render(this.scene, this.camera);
    }
}
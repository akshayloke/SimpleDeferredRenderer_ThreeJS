
THREE.SimpleDeferredRenderer = function ( parameters ) {

	var _this = this;

	var pixelWidth = parameters.width !== undefined ? parameters.width : 800;
	var pixelHeight = parameters.height !== undefined ? parameters.height : 600;
	var currentScale = parameters.scale !== undefined ? parameters.scale : 1;

	var scaledWidth = Math.floor( currentScale * pixelWidth );
	var scaledHeight = Math.floor( currentScale * pixelHeight );

	this.renderer = parameters.renderer;

	if ( this.renderer === undefined ) {

		this.renderer = new THREE.WebGLRenderer();
		this.renderer.setSize( pixelWidth, pixelHeight );
		this.renderer.setClearColor( 0x000000, 0 );

		this.renderer.autoClear = false;
	}

	this.domElement = this.renderer.domElement;

	//
	var gl = this.renderer.context;

	//
	var currentCamera = null;
	var black = new THREE.Color( 0x000000 );

	var normalDepthShader = THREE.ShaderDeferred[ "normalDepth" ];
	var colorShader = THREE.ShaderDeferred[ "color" ];
	var compositeShader = THREE.ShaderDeferred[ "passThrough" ];

	//
	var normalDepthComposer, colorComposer, finalComposer;
	var normalDepthPass, colorPass, finalPass;

	var defaultNormalDepthMaterial = new THREE.ShaderMaterial( {

		uniforms:       THREE.UniformsUtils.clone( normalDepthShader.uniforms ),
		vertexShader:   normalDepthShader.vertexShader,
		fragmentShader: normalDepthShader.fragmentShader,
		blending:		THREE.NoBlending

	} );
	
	//

	var initDeferredMaterials = function ( object ) {

		if ( object.material instanceof THREE.MeshFaceMaterial ) {

			var normalDepthMaterials = [];
			var colorMaterials = [];
			var materials = object.material.materials;

			for ( var i = 0, il = materials.length; i < il; i ++ ) {
				var deferredMaterials = createDeferredMaterials( materials[ i ] );
				normalDepthMaterials.push( deferredMaterials.normalDepthMaterial );
				colorMaterials.push( deferredMaterials.colorMaterial );
			}

			object.userData.normalDepthMaterial = new THREE.MeshFaceMaterial( normalDepthMaterials );
			object.userData.colorMaterial = new THREE.MeshFaceMaterial( colorMaterials );

		} else {

			var deferredMaterials = createDeferredMaterials( object.material );
			object.userData.normalDepthMaterial = deferredMaterials.normalDepthMaterial;
			object.userData.colorMaterial = deferredMaterials.colorMaterial;
		}

	};
	
	var createDeferredMaterials = function ( originalMaterial ) {

		var deferredMaterials = {};
		
		// color material
		var uniforms = THREE.UniformsUtils.clone( colorShader.uniforms );
		var defines = {};

		var colorMaterial = new THREE.ShaderMaterial ( {
			vertexShader: colorShader.vertexShader,
			fragmentShader: colorShader.fragmentShader,
			uniforms: uniforms,
			defines: defines,
			shading: originalMaterial.shading
		} );
		
		var diffuse = originalMaterial.color;
		var emissive = originalMaterial.emissive !== undefined? originalMaterial.emissive: black;

		if (originalMaterial instanceof THREE.MeshFaceMaterial) {
			diffuse = black;
			emissive = originalMaterial.color;
		}

		var specular = originalMaterial.specular !== undefined? originalMaterial.specular: black;
		var shininess = originalMaterial.shininess !== undefined? originalMaterial.shininess: 1;
		var wrapAround = originalMaterial.wrapAround !== undefined? ( originalMaterial.wrapAround? -1: 1): 1;
		var additiveSpecular = originalMaterial.additiveSpecular !== undefined? ( originalMaterial.metal? 1: -1): -1;

		uniforms.diffuse.value.copyGammaToLinear(diffuse);
		uniforms.specular.value.copyGammaToLinear(specular);
		uniforms.emissive.value.copyGammaToLinear(emissive);
		uniforms.shininess.value = shininess;
		uniforms.wrapAround.value = wrapAround;
		uniforms.additiveSpecular.value = additiveSpecular;

		colorMaterial.vertexColors = originalMaterial.vertexColors;

		deferredMaterials.colorMaterial = colorMaterial;

		// normal + depth material
	    // -----------------
	    
	    var normalDepthMaterial = defaultNormalDepthMaterial.clone();
	    normalDepthMaterial.vertexColors = originalMaterial.vertexColors;

	    deferredMaterials.normalDepthMaterial = normalDepthMaterial;

		return deferredMaterials;

	};

	var initDeferredProperties = function ( object ) {

		if ( object.userData.deferredInitialized ) return;

		if ( object.material ) initDeferredMaterials( object );

		object.userData.deferredInitialized = true;

	};

	//

	var setNormalDepthMaterial = function ( object ) {
		if ( object.material ) {
			object.material = object.userData.normalDepthMaterial;
		}
	};

	var setColorMaterial = function ( object ) {
		if ( object.material ) {
			object.material = object.userData.colorMaterial;
		}
	};

	// external API

	this.setScale = function ( scale ) {

		currentScale = scale;

		scaledWidth = Math.floor( currentScale * pixelWidth );
		scaledHeight = Math.floor( currentScale * pixelHeight );

		normalDepthComposer.setSize( scaledWidth, scaledHeight );
		colorComposer.setSize( scaledWidth, scaledHeight );
		finalComposer.setSize( scaledWidth, scaledHeight );

		colorComposer.renderTarget2.shareDepthFrom = normalDepthComposer.renderTarget2;

		finalPass.uniforms[ 'sampler' ].value = colorComposer.renderTarget2;

	};

	this.setSize = function ( width, height ) {

		pixelWidth = width;
		pixelHeight = height;

		this.renderer.setSize( pixelWidth, pixelHeight );

		this.setScale( currentScale );
	};

	this.render = function ( scene, camera ) {

		currentCamera = camera;

		normalDepthPass.camera = currentCamera;
		colorPass.camera = currentCamera;

		normalDepthPass.scene = scene;
		colorPass.scene = scene;
		
		scene.traverse( initDeferredProperties );

		// 1) g-buffer normals + depth pass
		scene.traverse( setNormalDepthMaterial );

		// clear shared depth buffer
		this.renderer.autoClearDepth = true;
		
		normalDepthComposer.render();

		// 2) g-buffer color pass
		scene.traverse( setColorMaterial );

		// clear shared depth buffer
		this.renderer.autoClearDepth = true;

		colorComposer.render();

		this.renderer.autoClearDepth = true;
		gl.depthFunc( gl.LEQUAL );

		finalComposer.render( 0.1 );

	};

	//

	var createRenderTargets = function ( ) {

		var rtParamsFloatLinear = { minFilter: THREE.NearestFilter, magFilter: THREE.LinearFilter, stencilBuffer: true, 
			format: THREE.RGBAFormat, type: THREE.FloatType };

		var rtParamsFloatNearest = { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, stencilBuffer: true, 
			format: THREE.RGBAFormat, type: THREE.FloatType };

		var rtParamsUByte = { minFilter: THREE.NearestFilter, magFilter: THREE.LinearFilter, stencilBuffer: false, 
			format: THREE.RGBFormat, type: THREE.UnsignedByteType };

		// g-buffers

		var rtNormalDepth = new THREE.WebGLRenderTarget( scaledWidth, scaledHeight, rtParamsFloatNearest );
		var rtColor = new THREE.WebGLRenderTarget( scaledWidth, scaledHeight, rtParamsFloatNearest );
		var rtFinal   = new THREE.WebGLRenderTarget( scaledWidth, scaledHeight, rtParamsUByte );

		rtNormalDepth.generateMipmaps = false;
		rtColor.generateMipmaps = false;
		rtFinal.generateMipmaps = false;

		// normal + depth composer
		normalDepthPass = new THREE.RenderPass();
		normalDepthPass.clear = true;

		normalDepthComposer = new THREE.EffectComposer( _this.renderer, rtNormalDepth );
		normalDepthComposer.addPass( normalDepthPass );

		//color composer
		colorPass = new THREE.RenderPass();
		colorPass.clear = true;

		colorComposer = new THREE.EffectComposer( _this.renderer, rtColor );
		colorComposer.addPass( colorPass );

		colorComposer.renderTarget2.shareDepthFrom = normalDepthComposer.renderTarget2;

		// final composer
		finalPass = new THREE.ShaderPass( compositeShader );
		finalPass.uniforms[ 'sampler' ].value = colorComposer.renderTarget2;
		finalPass.material.blending = THREE.NoBlending;
		finalPass.clear = true;

		//
		finalComposer = new THREE.EffectComposer( _this.renderer, rtFinal );
		finalComposer.addPass( finalPass );

		finalPass.renderToScreen = true;
		
	};

	// init

	createRenderTargets();

};

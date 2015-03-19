/**
 * @author alteredq / http://alteredqualia.com/
 * @author MPanknin / http://www.redplant.de/
 * @author benaadams / http://blog.illyriad.co.uk/
 *
 */


THREE.DeferredShaderChunk = {
	packVec3ToFloat: [
		"const float unit = 255.0 / 256.0; ",
		"float packVec3ToFloat( vec3 unpackedData) { ",
		"	highp float packedData = fract(unpackedData.x * unit) + floor(unpackedData.y * unit * 255.0) + floor(unpackedData.z * unit * 255.0) * 255.0;",
		"	return packedData;",
		"}"
	].join("\n"),

	unpackFloatFromVec3: [
		"vec3 unpackFloatFromVec3( float packedData ) { ",
		"	vec3 unpackedData;",
		"	unpackedData.x = fract(packedData);",
		"	float zInt = floor(packedData / 255.0); ",
		"	unpackedData.z = fract(zInt / 255.0); ",
		"	unpackedData.y = fract(floor(packedData - (zInt * 255.0)) / 255.0); ",
		"	return unpackedData; ",
		"}"

	].join("\n"),
};


THREE.ShaderDeferred = {

	"color" : {
		uniforms: THREE.UniformsUtils.merge( [
			{
				"diffuse" : { type: "c", value: new THREE.Color( 0xeeeeee ) },
				"specular" : { type: "c", value: new THREE.Color(0x111111 ) },
				"emissive" : { type: "c", value: new THREE.Color(0x000000 ) },
				"shininess" : { type: "f", value: 30 },
				"wrapAround" : { type: "f", value: 1 },
				"additiveSpecular" : { type: "f", value: 1 }
			}
		]),

		vertexShader: [
			THREE.ShaderChunk[ "color_pars_vertex" ],
			"void main() { ",
				THREE.ShaderChunk[ "color_vertex" ],
				THREE.ShaderChunk[ "default_vertex" ],
			"}"

		].join("\n"),

		fragmentShader: [
			"uniform vec3 diffuse;",
			"uniform vec3 specular;",
			"uniform vec3 emissive;",
			"uniform float shininess;",
			"uniform float wrapAround;",
			"uniform float additiveSpecular;",

			THREE.ShaderChunk[ "color_pars_fragment" ],
			THREE.DeferredShaderChunk[ "packVec3ToFloat" ],

			"void main() { ",
				"const float opacity = 1.0;",
				"gl_FragColor = vec4(diffuse, opacity);",

				THREE.ShaderChunk[ "color_fragment" ],

				"const float compressionScale = 1.0;",

				//diffuse color
				"gl_FragColor.x = packVec3ToFloat(compressionScale * diffuse);",

				//specular color
				"gl_FragColor.y = packVec3ToFloat(compressionScale * specular) * additiveSpecular;",

				//shininess
				"gl_FragColor.z = wrapAround * shininess;",

				//emissive color
				"#ifdef USE_COLOR",
					"gl_FragColor.w = packVec3ToFloat(compressionScale * emissive * vColor);",
				"#else",
					"gl_FragColor.w = packVec3ToFloat(compressionScale * emissive);",
				"#endif",

			"}"

		].join("\n")
	},

	"normalDepth" : {

		uniforms: {
		},

		vertexShader : [

			"varying vec3 viewSpaceNormal;",
			"varying vec4 clipSpacePosition;",

			"void main() {",

				"vec3 objectSpaceNormal = normal;",
				"viewSpaceNormal = normalize( normalMatrix * objectSpaceNormal );",

				"vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );",
				"gl_Position = projectionMatrix * mvPosition;",
				"clipSpacePosition = gl_Position;",

			"}"

		].join("\n"),

		fragmentShader : [

			"varying vec3 viewSpaceNormal;",
			"varying vec4 clipSpacePosition;",

			"void main() {",

				"vec3 normal = normalize( viewSpaceNormal );",

				"gl_FragColor.xyz = normal * 0.5 + 0.5;",
				"gl_FragColor.w = clipSpacePosition.z / clipSpacePosition.w;",

			"}"

		].join("\n")

	},

	"passThrough" : {

		uniforms: {
			sampler: 	{ type: "t", value: null }
		},

		vertexShader : [

			"varying vec2 texCoord;",

			"void main() {",

				"vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );",
				"gl_Position = projectionMatrix * mvPosition;",
				"texCoord = uv;",
				
			"}"

		].join("\n"),

		fragmentShader : [

			"varying vec2 texCoord;",
			"uniform sampler2D sampler;",

			"void main() {",

				"vec3 outColor = texture2D( sampler, texCoord ).xyz;",
				"gl_FragColor = vec4( outColor, 1.0 );",

			"}"

		].join("\n")

	}

};

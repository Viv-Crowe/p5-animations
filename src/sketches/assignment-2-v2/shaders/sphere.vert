precision highp float;

attribute vec3 a_vertexPosition;
attribute vec3 a_vertexNormal;
attribute vec2 a_textureCoordinates;

uniform mat4 u_projectionMatrix;
uniform mat4 u_viewMatrix;
uniform sampler2D u_positionsTexture;
uniform sampler2D u_velocitiesTexture;
uniform float u_sphereRadius;
uniform float u_paletteSize;

varying vec3 v_viewSpacePosition;
varying vec3 v_viewSpaceNormal;
varying float v_paletteIndex;

mat3 rotX(float a) { float c=cos(a),s=sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }
mat3 rotY(float a) { float c=cos(a),s=sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }
mat3 rotZ(float a) { float c=cos(a),s=sin(a); return mat3(c,s,0., -s,c,0., 0.,0.,1.); }

void main () {
    vec3 spherePosition = texture2D(u_positionsTexture, a_textureCoordinates).rgb;

    // Three independent hashes from particle UV → full random 3D orientation
    vec2 uv = a_textureCoordinates;
    float h1 = fract(sin(dot(uv, vec2(127.1, 311.7))) * 43758.5453);
    float h2 = fract(sin(dot(uv, vec2(269.5, 183.3))) * 12365.5453);
    float h3 = fract(sin(dot(uv, vec2(419.2, 371.9))) * 53478.3219);

    mat3 rot = rotY(h1 * 6.2832) * rotX((h2 - 0.5) * 3.1416) * rotZ(h3 * 6.2832);

    vec3 position = rot * a_vertexPosition * u_sphereRadius + spherePosition;

    v_viewSpacePosition = vec3(u_viewMatrix * vec4(position, 1.0));
    v_viewSpaceNormal   = vec3(u_viewMatrix * vec4(rot * a_vertexNormal, 0.0));

    gl_Position = u_projectionMatrix * vec4(v_viewSpacePosition, 1.0);

    v_paletteIndex = floor(h1 * u_paletteSize);
}

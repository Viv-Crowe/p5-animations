precision highp float;

varying vec3 v_viewSpacePosition;
varying vec3 v_viewSpaceNormal;
varying float v_paletteIndex;

void main () {
    // renderingTexture format: (normal.x, normal.y, paletteIndex, viewSpaceZ)
    // paletteIndex >= 0 for particles; background clear is -99999 (sentinel)
    gl_FragColor = vec4(v_viewSpaceNormal.x, v_viewSpaceNormal.y, v_paletteIndex, v_viewSpacePosition.z);
}

precision highp float;

attribute vec2  a_position;    // quad corner: (-1,-1) to (+1,+1)
attribute vec2  a_baseXZ;      // per-instance: world-space X,Z of hair base
attribute float a_height;      // per-instance: hair height (world units)
attribute float a_deflection;  // per-instance: horizontal X offset of tip
attribute float a_radius;      // per-instance: half-width in view space

uniform mat4  u_projectionMatrix;
uniform mat4  u_viewMatrix;
uniform float u_baseY;

varying vec2 v_uv;

void main() {
    vec3 worldBase = vec3(a_baseXZ.x,              u_baseY,            a_baseXZ.y);
    vec3 worldTip  = vec3(a_baseXZ.x + a_deflection, u_baseY + a_height, a_baseXZ.y);

    vec3 viewBase = (u_viewMatrix * vec4(worldBase, 1.0)).xyz;
    vec3 viewTip  = (u_viewMatrix * vec4(worldTip,  1.0)).xyz;

    vec3 axis  = normalize(viewTip - viewBase);
    vec3 right = normalize(cross(vec3(0.0, 0.0, -1.0), axis));

    float t      = a_position.y * 0.5 + 0.5;       // 0 = base, 1 = tip
    float taper  = mix(0.4, 1.0, smoothstep(0.0, 0.15, t));  // ankle taper at base
    vec3 center  = mix(viewBase, viewTip, t);
    vec3 viewPos = center + right * a_position.x * a_radius * taper;

    gl_Position = u_projectionMatrix * vec4(viewPos, 1.0);
    v_uv = a_position * 0.5 + 0.5;
}

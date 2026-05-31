precision highp float;

attribute vec2  a_position;  // quad corner: (-1,-1) to (+1,+1)
attribute vec2  a_baseXZ;    // per-instance: world X,Z of clump centre
attribute float a_radius;    // per-instance: half-size in view space
attribute float a_flatness;  // per-instance: Y scale (< 1 = squashed dome)

uniform mat4  u_projectionMatrix;
uniform mat4  u_viewMatrix;
uniform float u_baseY;

varying vec2 v_uv;

void main() {
    // Centre the dome slightly below hair base
    vec3 worldCenter = vec3(a_baseXZ.x, u_baseY - a_radius * 0.25, a_baseXZ.y);
    vec3 viewCenter  = (u_viewMatrix * vec4(worldCenter, 1.0)).xyz;

    // Billboard: offset in view space (X = right, Y = up), squash Y for dome silhouette
    vec2 offset = vec2(a_position.x * a_radius,
                       a_position.y * a_radius * a_flatness);

    vec3 viewPos = viewCenter + vec3(offset, 0.0);

    gl_Position = u_projectionMatrix * vec4(viewPos, 1.0);
    v_uv = a_position * 0.5 + 0.5;   // [0,1] range
}

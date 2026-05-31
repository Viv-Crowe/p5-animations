precision mediump float;

varying vec2 v_uv;

void main() {
    // Signed distance from centre in [-1,1] range
    vec2 p    = v_uv * 2.0 - 1.0;
    float r   = length(p);

    // Clip to circle
    if (r > 1.0) discard;

    // Hemisphere shading: fake normal from UV offset
    vec3 n = normalize(vec3(p, sqrt(max(0.0, 1.0 - dot(p, p)))));
    vec3 light = normalize(vec3(-0.4, 0.8, 0.5));
    float diff = max(dot(n, light), 0.0);

    // Muted sage-grey cell body colour, similar to SEM palette
    vec3 base    = vec3(0.52, 0.58, 0.54);
    vec3 color   = base * (0.35 + diff * 0.65);

    // Soft falloff at rim
    float alpha = smoothstep(1.0, 0.75, r) * 0.88;

    gl_FragColor = vec4(color, alpha);
}

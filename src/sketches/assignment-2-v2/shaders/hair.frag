precision mediump float;

varying vec2 v_uv;

void main() {
    // round cap: discard corners at tip
    if (v_uv.y > 0.88) {
        float dist = length(v_uv - vec2(0.5, 1.0)) * 2.0;
        if (dist > 1.0) discard;
    }

    // pale actin-filament beige with slight depth gradient
    vec3 base = vec3(0.82, 0.76, 0.68);
    vec3 dark = vec3(0.55, 0.50, 0.44);
    vec3 color = mix(dark, base, v_uv.y * 0.6 + 0.2);

    // rim highlight — bright strip down the lit side
    float edge = abs(v_uv.x - 0.5) * 2.0;       // 0 at centre, 1 at rim
    float rim  = pow(1.0 - edge, 3.0);
    color += rim * 0.18;

    gl_FragColor = vec4(color, 1.0);
}

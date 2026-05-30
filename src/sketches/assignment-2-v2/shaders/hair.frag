precision mediump float;

varying vec2 v_uv;

void main() {
    vec3 base      = vec3(80.0 / 255.0, 42.0 / 255.0, 18.0 / 255.0);
    vec3 highlight = vec3(140.0 / 255.0, 90.0 / 255.0, 55.0 / 255.0);

    vec3 color = base;

    if (v_uv.x < 0.35) {
        color = mix(color, highlight, 0.4);
    }

    // hemisphere cap: discard corners outside the rounded top
    if (v_uv.y > 0.85) {
        float dist = length(v_uv - vec2(0.5, 1.0)) * 2.0;
        if (dist > 1.0) discard;
    }

    gl_FragColor = vec4(color, 1.0);
}

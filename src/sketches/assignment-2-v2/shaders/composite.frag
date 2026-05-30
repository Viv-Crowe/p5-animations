precision highp float;

varying vec2 v_coordinates;

uniform sampler2D u_renderingTexture;
uniform sampler2D u_occlusionTexture;

uniform vec2 u_resolution;
uniform float u_fov;

uniform mat4 u_inverseViewMatrix;

uniform sampler2D u_shadowDepthTexture;
uniform vec2 u_shadowResolution;
uniform mat4 u_lightProjectionViewMatrix;

uniform sampler2D u_palette;
uniform float u_paletteSize;

void main () {
    vec4 data = texture2D(u_renderingTexture, v_coordinates);

    // B channel holds stable per-particle palette index (>= 0), or -99999 for background
    float paletteIndex = data.b;

    if (paletteIndex < 0.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
    } else {
        float occlusion = texture2D(u_occlusionTexture, v_coordinates).r;

        float viewSpaceZ = data.a;
        vec3 viewRay = vec3(
            (v_coordinates.x * 2.0 - 1.0) * tan(u_fov / 2.0) * u_resolution.x / u_resolution.y,
            (v_coordinates.y * 2.0 - 1.0) * tan(u_fov / 2.0),
            -1.0);

        vec3 viewSpacePosition = viewRay * -viewSpaceZ;
        vec3 worldSpacePosition = vec3(u_inverseViewMatrix * vec4(viewSpacePosition, 1.0));

        vec3 color;
        if (u_paletteSize > 0.0) {
            float u = (paletteIndex + 0.5) / u_paletteSize;
            color = texture2D(u_palette, vec2(u, 0.5)).rgb;
        } else {
            color = vec3(0.7, 0.75, 0.85);
        }

        vec4 lightSpacePosition = u_lightProjectionViewMatrix * vec4(worldSpacePosition, 1.0);
        lightSpacePosition /= lightSpacePosition.w;
        lightSpacePosition *= 0.5;
        lightSpacePosition += 0.5;
        vec2 lightSpaceCoordinates = lightSpacePosition.xy;

        float shadow = 1.0;
        const int PCF_WIDTH = 2;
        const float PCF_NORMALIZATION = float(PCF_WIDTH * 2 + 1) * float(PCF_WIDTH * 2 + 1);

        for (int xOffset = -PCF_WIDTH; xOffset <= PCF_WIDTH; ++xOffset) {
            for (int yOffset = -PCF_WIDTH; yOffset <= PCF_WIDTH; ++yOffset) {
                float shadowSample = texture2D(u_shadowDepthTexture, lightSpaceCoordinates + 5.0 * vec2(float(xOffset), float(yOffset)) / u_shadowResolution).r;
                if (lightSpacePosition.z > shadowSample + 0.001) shadow -= 1.0 / PCF_NORMALIZATION;
            }
        }

        float ambient = 1.0 - occlusion * 0.7;
        float direct  = 1.0 - (1.0 - shadow) * 0.8;
        color *= ambient * direct;

        gl_FragColor = vec4(color, 1.0);
    }
}

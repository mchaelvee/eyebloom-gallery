// Single source of truth. Tweak values here to re-skin without touching scenes.

export const config = {
  // Gallery (room 1) theme
  theme: {
    name: 'moody-warm',

    wallColor:    0xe5d8c0,
    floorTint:    0xb89870,
    ceilingColor: 0x0a0807,
    skirtingColor: 0x080604,

    textures: {
      floor: {
        diff:  'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/dark_wood/dark_wood_diff_1k.jpg',
        nor:   'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/dark_wood/dark_wood_nor_gl_1k.jpg',
        rough: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/dark_wood/dark_wood_rough_1k.jpg',
        repeatPerMeter: [0.55, 0.55],
      },
      wall: {
        diff:  'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/painted_plaster_wall/painted_plaster_wall_diff_1k.jpg',
        nor:   'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/painted_plaster_wall/painted_plaster_wall_nor_gl_1k.jpg',
        rough: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/painted_plaster_wall/painted_plaster_wall_rough_1k.jpg',
        repeatPerMeter: [0.32, 0.32],
      },
    },

    ambientColor:     0xfff0d6,
    ambientIntensity: 0.46,

    hemiSky:    0xffe6c4,
    hemiGround: 0x1a120c,
    hemiIntensity: 0.42,

    // Visible glowing disks on the recessed ceiling fixtures.
    diskColor: 0xfff1c8,

    pictureLightColor:     0xffd9a8,
    pictureLightIntensity: 7.5,

    fogColor:   0x09060a,
    fogNear:    20,
    fogFar:     65,

    backgroundColor: 0x05030a,

    toneMappingExposure: 1.05,
  },

  // Tattoo room (room 2)
  tattoo: {
    wallColor:   0x2c2620,
    floorTint:   0x80624a,
    accentColor: 0xff3a3a,
    ambientIntensity: 0.62,
    keyLightColor:    0xfff0e0,
    keyLightIntensity: 7.0,
    redNeonIntensity: 4.0,
    cyanNeonIntensity: 3.4,
    cyanNeonColor: 0x6cf0ff,
    fogColor: 0x0a0710,
    fogNear:  14,
    fogFar:   38,
  },

  world: {
    height: 4.4,
    wallThickness: 0.18,

    galleryWidth:  10,
    // Asymmetric split — paintings room is bigger.
    galleryLength: 50,
    paintingsLength: 30,   // length of front (paintings) section
    // drawingsLength is computed: galleryLength - paintingsLength = 20

    tattooWidth:   10,
    tattooLength:  10,

    doorWidth:  2,
    doorHeight: 2.6,

    arch: {
      panelWidth:    3.4,
      headerHeight:  1.0,
      openingWidth:  3.2,
    },
  },

  sections: {
    paintings: {
      label: 'PAINTINGS',
      side: 'front',
    },
    drawings: {
      label: 'DRAWINGS',
      side: 'back',
    },
  },

  player: {
    eyeHeight:   1.65,
    radius:      0.35,
    walkSpeed:   3.6,
    sprintSpeed: 6.0,
    lookSensitivity: 0.0040,         // bumped (was 0.0030 — felt sluggish)
    touchLookSensitivity: 0.0060,    // bumped
    startZ: 22,                       // matches longer gallery
  },

  art: {
    frameDepth:  0.06,
    frameInset:  0.04,
    matInset:    0.03,
    hangHeight:  1.65,
    maxWidth:    1.7,
    maxHeight:   1.25,
    focusDistance: 2.4,
  },

  bloom: {
    enabled:   true,
    strength:  0.45,                 // toned down (was 0.55)
    radius:    0.40,
    threshold: 0.82,
    skipOnTouch: false,
  },

  performance: {
    dynamicResolution: true,
    targetFps: 48,
    desktopPixelRatio: 2.0,
    desktopInitialPixelRatio: 1.7,
    mobilePixelRatio: 1.55,
    mobileInitialPixelRatio: 1.35,
    antialias: true,
    minPixelRatio: 1.0,
    pickInterval: 0.1,
    warmup: {
      enabled: true,
      minLoadMs: 2400,
      framesPerView: 2,
    },

    // PBR / quality flags.
    bakedRoomMaterials:    false,
    fastRoomMaterials:     false,
    fastArtMaterials:      false,
    // PBR maps off — saves ~3 texture samples per fragment over walls/floor.
    // Diff-only PBR still looks great with the warm lighting scheme.
    useHighCostMaterialMaps: false,

    perPieceSpotLight:     false,
    maxSpotLights:         4,
    touchSpotLightDivisor: 2,

    // Fewer fill SpotLights in the gallery ceiling (heavy due to PBR shader recompile).
    ceilingFillSpotCount:  2,

    // Anisotropy cap applied to all textures.
    anisotropy:            16,
  },
};

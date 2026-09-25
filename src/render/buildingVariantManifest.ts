// Wave 2 visual variants (V1): same grade, different look. Each pool lists its variants; `base` is the art that was
// already installed. Every variant image is painted in its base's frame (same canvas proportions and ground pivot),
// so it reuses the base's authored registration; the image is only sampled at its own resolution.
// `requires: "inside_wall"`: only for a building inside a completed wall (palisadeProtectionForBuilding, the same test as
// the L4 "protected" requirement). Art bible: thatch outside the walls, flat clay tile inside; so the L1 tile variant
// is never picked in a town without a finished wall.
// Not in this manifest on purpose: the pastoral farm set (held until sheep, C5), the mixed farm set (retired with the
// wheat farm, C1f; both in assets-inbox) and the rejected L1 thatch variant.
// Variant ids are internal only; the building panel keeps the grade names.
export const BUILDING_VARIANT_POOLS = [
  {
    "pool": "building:house_l0",
    "namespace": "building",
    "kind": "house",
    "level": 0,
    "lot": "single",
    "variants": [
      {
        "id": "base",
        "weight": 1,
        "family": "base",
        "url": null
      },
      {
        "id": "garden",
        "weight": 1,
        "family": "subsistence",
        "url": "assets/buildings/variants-wave2/house_l0_garden-v1.png",
        "width": 153,
        "height": 153
      },
      {
        "id": "pen",
        "weight": 1,
        "family": "livestock",
        "url": "assets/buildings/variants-wave2/house_l0_pen-v1.png",
        "width": 153,
        "height": 153
      }
    ]
  },
  {
    "pool": "building:house_l1",
    "namespace": "building",
    "kind": "house",
    "level": 1,
    "lot": "single",
    "variants": [
      {
        "id": "base",
        "weight": 1,
        "family": "base",
        "url": null
      },
      {
        "id": "artisan",
        "weight": 1,
        "family": "craft",
        "url": "assets/buildings/variants-wave2/house_l1_artisan-v1.png",
        "width": 139,
        "height": 139
      },
      {
        "id": "garden",
        "weight": 1,
        "family": "subsistence",
        "url": "assets/buildings/variants-wave2/house_l1_garden-v1.png",
        "width": 139,
        "height": 139
      },
      {
        "id": "tile",
        "weight": 1,
        "family": "tile",
        "url": "assets/buildings/variants-wave2/house_l1_tile-v1.png",
        "width": 139,
        "height": 139,
        "requires": "inside_wall"
      }
    ]
  },
  {
    "pool": "building:house_l2",
    "namespace": "building",
    "kind": "house",
    "level": 2,
    "lot": "single",
    "variants": [
      {
        "id": "base",
        "weight": 1,
        "family": "base",
        "url": null
      },
      {
        "id": "brewer",
        "weight": 1,
        "family": "craft",
        "url": "assets/buildings/variants-wave2/house_l2_brewer-v1.png",
        "width": 137,
        "height": 137
      },
      {
        "id": "garden",
        "weight": 1,
        "family": "subsistence",
        "url": "assets/buildings/variants-wave2/house_l2_garden-v1.png",
        "width": 137,
        "height": 137
      },
      {
        "id": "weaver",
        "weight": 1,
        "family": "craft",
        "url": "assets/buildings/variants-wave2/house_l2_weaver-v1.png",
        "width": 137,
        "height": 137
      }
    ]
  },
  {
    "pool": "building:house_l3",
    "namespace": "building",
    "kind": "house",
    "level": 3,
    "lot": "single",
    "variants": [
      {
        "id": "base",
        "weight": 1,
        "family": "base",
        "url": null
      },
      {
        "id": "clothier",
        "weight": 1,
        "family": "craft",
        "url": "assets/buildings/variants-wave2/house_l3_clothier-v1.png",
        "width": 142,
        "height": 142
      },
      {
        "id": "shop",
        "weight": 1,
        "family": "trade",
        "url": "assets/buildings/variants-wave2/house_l3_shop-v1.png",
        "width": 142,
        "height": 142
      },
      {
        "id": "storage",
        "weight": 1,
        "family": "trade",
        "url": "assets/buildings/variants-wave2/house_l3_storage-v1.png",
        "width": 142,
        "height": 142
      }
    ]
  },
  {
    "pool": "building:house_l4",
    "namespace": "building",
    "kind": "house",
    "level": 4,
    "lot": "single",
    "variants": [
      {
        "id": "base",
        "weight": 1,
        "family": "base",
        "url": null
      },
      {
        "id": "courtyard",
        "weight": 1,
        "family": "estate",
        "url": "assets/buildings/variants-wave2/house_l4_courtyard-v1.png",
        "width": 161,
        "height": 161
      },
      {
        "id": "inn",
        "weight": 1,
        "family": "trade",
        "url": "assets/buildings/variants-wave2/house_l4_inn-v1.png",
        "width": 161,
        "height": 161
      },
      {
        "id": "wing",
        "weight": 1,
        "family": "estate",
        "url": "assets/buildings/variants-wave2/house_l4_wing-v1.png",
        "width": 161,
        "height": 161
      }
    ]
  },
  {
    "pool": "building:house_pair_l3_horizontal",
    "namespace": "building",
    "kind": "house",
    "level": 3,
    "lot": "horizontal",
    "variants": [
      {
        "id": "base",
        "weight": 1,
        "family": "base",
        "url": null
      },
      {
        "id": "courtyard",
        "weight": 1,
        "family": "estate",
        "url": "assets/buildings/variants-wave2/house_pair_l3_horizontal_courtyard-v1.png",
        "width": 209,
        "height": 167
      }
    ]
  },
  {
    "pool": "building:house_pair_l3_vertical",
    "namespace": "building",
    "kind": "house",
    "level": 3,
    "lot": "vertical",
    "variants": [
      {
        "id": "base",
        "weight": 1,
        "family": "base",
        "url": null
      },
      {
        "id": "workshop",
        "weight": 1,
        "family": "estate",
        "url": "assets/buildings/variants-wave2/house_pair_l3_vertical_workshop-v1.png",
        "width": 183,
        "height": 183
      }
    ]
  },
  {
    "pool": "building:house_pair_l4_horizontal",
    "namespace": "building",
    "kind": "house",
    "level": 4,
    "lot": "horizontal",
    "variants": [
      {
        "id": "base",
        "weight": 1,
        "family": "base",
        "url": null
      },
      {
        "id": "hall",
        "weight": 1,
        "family": "estate",
        "url": "assets/buildings/variants-wave2/house_pair_l4_horizontal_hall-v1.png",
        "width": 204,
        "height": 204
      }
    ]
  },
  {
    "pool": "building:house_pair_l4_vertical",
    "namespace": "building",
    "kind": "house",
    "level": 4,
    "lot": "vertical",
    "variants": [
      {
        "id": "base",
        "weight": 1,
        "family": "base",
        "url": null
      },
      {
        "id": "court",
        "weight": 1,
        "family": "estate",
        "url": "assets/buildings/variants-wave2/house_pair_l4_vertical_court-v1.png",
        "width": 184,
        "height": 184
      }
    ]
  },
  {
    "pool": "building:well",
    "namespace": "building",
    "kind": "well",
    "variants": [
      {
        "id": "base",
        "weight": 1,
        "family": "base",
        "url": null
      },
      {
        "id": "b",
        "weight": 1,
        "family": "b",
        "url": "assets/buildings/variants-wave2/well_b-v1.png",
        "width": 72,
        "height": 80
      },
      {
        "id": "c",
        "weight": 1,
        "family": "c",
        "url": "assets/buildings/variants-wave2/well_c-v1.png",
        "width": 72,
        "height": 80
      }
    ]
  },
  {
    "pool": "building:farmstead",
    "namespace": "building",
    "kind": "farmstead",
    "variants": [
      { "id": "a", "weight": 1, "family": "a", "url": "assets/buildings/farmstead/farmstead_a-v1.png", "width": 160, "height": 136 },
      { "id": "b", "weight": 1, "family": "b", "url": "assets/buildings/farmstead/farmstead_b-v1.png", "width": 160, "height": 136 },
      { "id": "working", "weight": 0, "family": "working", "url": "assets/buildings/farmstead/farmstead_working-v1.png", "width": 160, "height": 136 }
    ]
  },
  {
    "pool": "building:storehouse",
    "namespace": "building",
    "kind": "storehouse",
    "variants": [
      {
        "id": "base",
        "weight": 1,
        "family": "base",
        "url": null
      },
      {
        "id": "b",
        "weight": 1,
        "family": "b",
        "url": "assets/buildings/variants-wave2/storehouse_b-v1.png",
        "width": 160,
        "height": 136
      },
      {
        "id": "c",
        "weight": 1,
        "family": "c",
        "url": "assets/buildings/variants-wave2/storehouse_c-v1.png",
        "width": 160,
        "height": 136
      }
    ]
  },
  {
    "pool": "building:market",
    "namespace": "building",
    "kind": "market",
    "variants": [
      {
        "id": "base",
        "weight": 1,
        "family": "base",
        "url": null
      },
      {
        "id": "b",
        "weight": 1,
        "family": "b",
        "url": "assets/buildings/variants-wave2/market_active_b-v1.png",
        "width": 224,
        "height": 224,
        "quiet": {
          "id": "b",
          "weight": 1,
          "family": "b",
          "url": "assets/buildings/variants-wave2/market_quiet_b-v1.png",
          "width": 224,
          "height": 224
        }
      },
      {
        "id": "c",
        "weight": 1,
        "family": "c",
        "url": "assets/buildings/variants-wave2/market_active_c-v1.png",
        "width": 224,
        "height": 224
      }
    ]
  },
  {
    "pool": "building:chapel",
    "namespace": "building",
    "kind": "chapel",
    "variants": [
      {
        "id": "base",
        "weight": 1,
        "family": "base",
        "url": null
      },
      {
        "id": "b",
        "weight": 1,
        "family": "b",
        "url": "assets/buildings/variants-wave2/chapel_b-v1.png",
        "width": 133,
        "height": 133
      },
      {
        "id": "stone",
        "weight": 1,
        "family": "stone",
        "url": "assets/buildings/variants-wave2/chapel_stone-v1.png",
        "width": 133,
        "height": 133
      }
    ]
  },
  {
    "pool": "building:mill",
    "namespace": "building",
    "kind": "mill",
    "variants": [
      {
        "id": "base",
        "weight": 1,
        "family": "base",
        "url": null
      },
      {
        "id": "windmill",
        "weight": 1,
        "family": "windmill",
        "url": "assets/buildings/variants-wave2/windmill-v1.png",
        "width": 142,
        "height": 142
      }
    ]
  },
] as const;

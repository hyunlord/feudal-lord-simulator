export const historicalFacilityManifest = [
  {
    "id": "mill",
    "kind": "mill",
    "url": "assets/buildings/historical-facilities-v1/mill-v2.png",
    "width": 1254,
    "height": 1254,
    "source": {
      "x": 122,
      "y": 67,
      "width": 1025,
      "height": 1090
    },
    "displayWidth": 58,
    "sha256": "ba012a11fd8810e160f9bab00c0dfa1f7e1ce5ce7ffe0a43778eb7d824e0dc33"
  },
  {
    "id": "masonry",
    "kind": "masonry",
    "url": "assets/buildings/historical-facilities-v1/masonry-v2.png",
    "width": 1254,
    "height": 1254,
    "source": {
      "x": 125,
      "y": 91,
      "width": 1021,
      "height": 1059
    },
    "displayWidth": 56,
    "sha256": "f11bdb7359c9e1e92058456e6238fa527c1a0ee133a94cc579e9684f6c6070d2"
  },
  {
    "id": "sawmill",
    "kind": "sawmill",
    "url": "assets/buildings/historical-facilities-v1/sawmill-v2.png",
    "width": 1254,
    "height": 1254,
    "source": {
      "x": 80,
      "y": 56,
      "width": 1155,
      "height": 1072
    },
    "displayWidth": 56,
    "sha256": "137b192eb1c1e409f9e5d2e508f06ad5839755af3c6f5ec878abee4bfb2cfac6"
  },
  {
    "id": "chapel",
    "kind": "chapel",
    "url": "assets/buildings/historical-facilities-v1/chapel-v2.png",
    "width": 1254,
    "height": 1254,
    "source": {
      "x": 126,
      "y": 55,
      "width": 1060,
      "height": 1134
    },
    "displayWidth": 56,
    "sha256": "f63aaf03643a8d49236efde29f62821ecbc6934b680d0f7e6387134952202ba6"
  },
  {
    "id": "church",
    "kind": "church",
    "url": "assets/buildings/historical-facilities-v1/church-v2.png",
    "width": 1254,
    "height": 1254,
    "source": {
      "x": 47,
      "y": 83,
      "width": 1163,
      "height": 1077
    },
    "displayWidth": 108,
    "sha256": "67d46668f7cb601d2a3ac13ea4f291c9946e28cf25f8ec6c9d5a40f1a5eb47ae"
  },
  {
    "id": "keep",
    "kind": "keep",
    "url": "assets/buildings/historical-facilities-v1/keep-v2.png",
    "width": 1254,
    "height": 1254,
    "source": {
      "x": 223,
      "y": 41,
      "width": 832,
      "height": 1155
    },
    "displayWidth": 94,
    "sha256": "f58a040bae034799e31f51150aa66ee268d8c48af72904da91c1073b0e1d13de"
  },
  {
    "id": "market_quiet",
    "kind": "market",
    "url": "assets/buildings/historical-facilities-v1/market_quiet-v2.png",
    "width": 1254,
    "height": 1254,
    "source": {
      "x": 35,
      "y": 50,
      "width": 1213,
      "height": 1146
    },
    "displayWidth": 108,
    "sha256": "89acafa5626f7377529dbb79f688d11d126cd87f088ff6f522293d18a7ae0533"
  },
  {
    "id": "quarry_active",
    "kind": "quarry",
    "url": "assets/buildings/historical-facilities-v1/quarry_active-v2.png",
    "width": 1254,
    "height": 1254,
    "source": {
      "x": 15,
      "y": 160,
      "width": 1224,
      "height": 952
    },
    "displayWidth": 112,
    "sha256": "01e5a0058cf2ab50c2c2b4530ce950f23993b3a0dff15c7c02fe2e1c8f2b9268"
  },
  {
    "id": "market_active",
    "kind": "market",
    "url": "assets/buildings/historical-facilities-v1/market_active-v2.png",
    "width": 1254,
    "height": 1254,
    "source": {
      "x": 35,
      "y": 50,
      "width": 1213,
      "height": 1146
    },
    "displayWidth": 108,
    "sha256": "1cc7026d2316ee0819c05d39499f4bc14362259fb18be503a85abe26fc00b407"
  },
  {
    "id": "quarry_idle",
    "kind": "quarry",
    "url": "assets/buildings/historical-facilities-v1/quarry_idle-v2.png",
    "width": 1254,
    "height": 1254,
    "source": {
      "x": 15,
      "y": 160,
      "width": 1224,
      "height": 952
    },
    "displayWidth": 112,
    "sha256": "0a5d0d68cda75e7c580d6f3c64befd46859bc2c1beb60a87cf5ab3a3581aab4e"
  },
  {
    "id": "quarry_depleted",
    "kind": "quarry",
    "url": "assets/buildings/historical-facilities-v1/quarry_depleted-v2.png",
    "width": 1254,
    "height": 1254,
    "source": {
      "x": 15,
      "y": 160,
      "width": 1224,
      "height": 952
    },
    "displayWidth": 112,
    "sha256": "9b686edcfd10affb1d9185d7febf64a341e2463e42e706cee79a77843c6e8dc3"
  }
] as const;

export type HistoricalFacilityAssetId = typeof historicalFacilityManifest[number]["id"];

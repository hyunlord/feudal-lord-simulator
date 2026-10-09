# Kept-trace seed 1 independent verification

Single-seed preliminary evidence only. Seeds 2 and 3 are not included; this is not a final three-seed gate.

Input SHA256: 3cf11889398f36ac8dc8c0230dc509d5e46cbaa8abdcd1f568d7a0744600dbfd

Source: 2485af40046793f1856829fa1161dc4431942aa7; dirtyPaths empty.

Independently derived from raw decision, history and seasonal report-line archives. Original three-year window: history strictly after decision tick and no later than decision+12000, retaining endpoint history through500000. Decisions restricted to[0,500000); answered coverage excludes lapsed. No cached summary metric used for recomputation.

Checks:

```json
{
  "period": true,
  "clean": true,
  "complete": true,
  "candidateFailures": 0,
  "support56": true,
  "summaryMismatches": []
}
```

## Control versus kept trace

```json
{
  "control": {
    "density": {
      "whole": {
        "total": 91,
        "median": 1,
        "maximum": 4,
        "zeroYears": 62,
        "aboveFourYears": 0
      },
      "registry": {
        "total": 38,
        "median": 0,
        "maximum": 2,
        "zeroYears": 91,
        "aboveFourYears": 0
      },
      "b11": {
        "total": 4,
        "median": 0,
        "maximum": 1,
        "zeroYears": 121,
        "aboveFourYears": 0
      }
    },
    "matureAnsweredLord": {
      "denominator": 156,
      "linked": 132
    },
    "matureAnsweredRegistry": {
      "denominator": 35,
      "linked": 26
    },
    "matureAnsweredB11": {
      "denominator": 3,
      "linked": 1
    },
    "steward": {
      "denominator": 641,
      "witnessed": 641
    }
  },
  "kept": {
    "density": {
      "whole": {
        "total": 91,
        "median": 1,
        "maximum": 4,
        "zeroYears": 62,
        "aboveFourYears": 0
      },
      "registry": {
        "total": 38,
        "median": 0,
        "maximum": 2,
        "zeroYears": 91,
        "aboveFourYears": 0
      },
      "b11": {
        "total": 4,
        "median": 0,
        "maximum": 1,
        "zeroYears": 121,
        "aboveFourYears": 0
      }
    },
    "matureAnsweredLord": {
      "denominator": 156,
      "linked": 132
    },
    "matureAnsweredRegistry": {
      "denominator": 35,
      "linked": 26
    },
    "matureAnsweredB11": {
      "denominator": 3,
      "linked": 1
    },
    "steward": {
      "denominator": 641,
      "witnessed": 641
    }
  }
}
```

## Nine prior missing registry links

Matched by exact decision tick and source, because appended history may renumber IDs.

```json
[
  {
    "oldId": "h-002358",
    "tick": 36037,
    "source": "registry:ck_evt_038:defer",
    "currentId": "h-002358",
    "currentMature": true,
    "currentFutureCount": 0,
    "firstFuture": null
  },
  {
    "oldId": "h-007606",
    "tick": 117001,
    "source": "registry:ck_evt_140:b",
    "currentId": "h-007606",
    "currentMature": true,
    "currentFutureCount": 0,
    "firstFuture": null
  },
  {
    "oldId": "h-022834",
    "tick": 350065,
    "source": "registry:ck_evt_092:a",
    "currentId": "h-022834",
    "currentMature": true,
    "currentFutureCount": 0,
    "firstFuture": null
  },
  {
    "oldId": "h-024261",
    "tick": 373075,
    "source": "registry:ck_evt_211:a",
    "currentId": "h-024261",
    "currentMature": true,
    "currentFutureCount": 0,
    "firstFuture": null
  },
  {
    "oldId": "h-024777",
    "tick": 382045,
    "source": "registry:ck_evt_211:c",
    "currentId": "h-024777",
    "currentMature": true,
    "currentFutureCount": 0,
    "firstFuture": null
  },
  {
    "oldId": "h-026011",
    "tick": 401077,
    "source": "registry:ck_evt_211:b",
    "currentId": "h-026011",
    "currentMature": true,
    "currentFutureCount": 0,
    "firstFuture": null
  },
  {
    "oldId": "h-027319",
    "tick": 420031,
    "source": "registry:ck_evt_211:b",
    "currentId": "h-027319",
    "currentMature": true,
    "currentFutureCount": 0,
    "firstFuture": null
  },
  {
    "oldId": "h-027390",
    "tick": 421045,
    "source": "registry:ck_evt_092:a",
    "currentId": "h-027390",
    "currentMature": true,
    "currentFutureCount": 0,
    "firstFuture": null
  },
  {
    "oldId": "h-028626",
    "tick": 440077,
    "source": "registry:ck_evt_211:b",
    "currentId": "h-028626",
    "currentMature": true,
    "currentFutureCount": 0,
    "firstFuture": null
  }
]
```

Remaining mature answered missing IDs, censored coverage, full provenance and observation checks are in verification.json. Link records prove engine history attribution only; first because ordering is not independent causal proof and no rendered visibility is verified. Same-time effects remain excluded from future coverage. The control and new runs are separate source revisions, not independent seeds.

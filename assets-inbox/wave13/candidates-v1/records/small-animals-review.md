# Small animal sheets

Four sheets: sheep 48×40, pig 48×40, goose 32×32, herding dog 40×32. Four columns NE/SE/SW/NW; row1 stationary/base, row2 alternate step. The sheep pair was prototyped and reviewed first before the other species.

The model's edit was not inherently pixel exact. The final pair uses edited lower legs only, with manually constrained leg rectangles, and copies all protected RGBA pixels from frame1. Head, torso, ears, neck and tail do not bob. Rectangles and masks are saved per direction; white is protected, black editable. The enlarged comparison is diagnostic, not runtime zoom. No direction was made by mirroring or whole-animal translation.

Native/enlarged alternation is visible, strongest in pig and goose; wool and shag obscure upper joints. At source0.3 scale the few-pixel feet become subpixel, so clear gait recognition is not guaranteed at zoom0.6. Goose rear-quarter directions are shallow and its head is naturally side-on; this is not claimed to be a perfect orthographic reconstruction. Painting fidelity does not establish real runtime animation correctness.

All sprites are transparent and candidate-only. No game files changed. Reference sheep flock is style-only for dog/goose; pig uses attached pig_pair. Generation model/version/seed was not provided and is not inferred.

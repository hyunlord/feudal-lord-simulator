# Wave6 effects self-review

- 8 native-generation calls for8requestedPNG; onecandidateeach; no gamefileswritten.
- Exact target dimensions and outermostedge fullytransparent: PASS8/8.
- Completion is384x128 horizontal3cells; anchors each(64,120). Three distinct states: compact burst, spread dust+restrainedglints, dissipatingwisps.
- Otheranchors (W/2,H-2), true RGBA retained.
- Source and0.3scale olivebackground visuallyinspected: smoke plume, fire, grounddust andstake silhouettesreadable. At0.3scale32px effects areabout10px: hammerdust vs placementdust cannot be distinguished reliably by texturealone; code timing/location isneeded. Not a failureofalpha but display-size limitation.
- SmokeA/B differ bends and topmass. Firelarge differs breadth andtongues, not ascaled copy.
- Stake ribbon is recognizable atsource/.5; at.3 it is only a tiny pale notch; zoomed inspectionneeded for ribbon detail.
- Grain in originalgenerations reduced by singlefinalresize; no extra proceduralgrain added.
- No runtime animation, GPU, performance or in-gameinstallation validated.

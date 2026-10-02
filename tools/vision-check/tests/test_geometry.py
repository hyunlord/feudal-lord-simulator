"""Algorithm contract checks use both injected defects and healthy controls."""
import numpy as np

from vision_check import geometry
from vision_check.models import Box


def test_iou_when_boxes_are_disjoint() -> None:
    # Given: disjoint boxes.
    first,second=Box(x=0,y=0,width=10,height=10),Box(x=20,y=20,width=10,height=10)
    # When: overlap is measured.
    actual=geometry.iou(first,second)
    # Then: a distant person cannot count as roof overlap.
    assert actual==0.0

def test_iou_when_boxes_are_identical() -> None:
    # Given: the same box.
    box=Box(x=3,y=4,width=20,height=30)
    # When/Then: overlap is complete.
    assert geometry.iou(box,box)==1.0

def test_boundary_contrast_when_uniform_ground() -> None:
    # Given: flat ground and a hypothetical isometric line.
    image=np.full((160,240,3),120,dtype=np.uint8)
    # When/Then: geometry alone does not establish a visible edge.
    assert geometry.line_contrast(image,(20,40,200,130))<0.1

def test_boundary_contrast_when_two_regions_meet() -> None:
    # Given: a sharp 1:2 slope boundary.
    image=np.full((160,240,3),70,dtype=np.uint8)
    for y in range(160):
        image[y,:min(240,max(0,2*(y-30)))]=180
    # When/Then: a genuine colour discontinuity is visible.
    assert geometry.line_contrast(image,(20,40,200,130))>50

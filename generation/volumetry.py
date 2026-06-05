"""
volumetry.py
Génère un modèle IFC4 à partir du layout 2D JSON.
Utilise ifcopenshell.
"""

import json
import sys
import math
import uuid
import subprocess
from pathlib import Path
from datetime import datetime

try:
    import ifcopenshell
    import ifcopenshell.api
    import ifcopenshell.api.root
    import ifcopenshell.api.unit
    import ifcopenshell.api.geometry
    import ifcopenshell.api.spatial
    import ifcopenshell.api.aggregate
    import ifcopenshell.geom
except ImportError:
    print("ifcopenshell non disponible — module volumetry désactivé", file=sys.stderr)
    ifcopenshell = None

EPAISSEUR_MUR_EXT_M = 0.30
EPAISSEUR_MUR_INT_M = 0.15
EPAISSEUR_DALLE_M = 0.25
HAUTEUR_ALLEGE_M = 0.9
HAUTEUR_BAIE_M = 2.1
HAUTEUR_ETAGE_M = 3.0
HAUTEUR_SS_M = 2.8


def hauteur_niveau(niveau):
    if niveau == "sous_sol":
        return HAUTEUR_SS_M
    return HAUTEUR_ETAGE_M


def elevation_niveau(niveau, niveaux_actifs):
    order = ["sous_sol", "rdc", "etage"]
    niveaux_presents = [n for n in order if n in niveaux_actifs]
    idx = niveaux_presents.index(niveau) if niveau in niveaux_presents else 0
    elev = 0.0
    for i, n in enumerate(niveaux_presents):
        if i == idx:
            break
        elev += hauteur_niveau(n)
    if "sous_sol" in niveaux_presents:
        ss_idx = niveaux_presents.index("sous_sol")
        if niveau == "sous_sol":
            return -HAUTEUR_SS_M
        elev_offset = 0.0
        for n in niveaux_presents:
            if n == "sous_sol":
                continue
            if n == niveau:
                break
            elev_offset += hauteur_niveau(n)
        return elev_offset
    return elev


class VolumetryGenerator:
    def __init__(self, layout, programme):
        self.layout = layout
        self.programme = programme
        self.ifc = None
        self.project = None
        self.site = None
        self.building = None
        self.owner_history = None
        self.context = None

    def generate(self):
        if ifcopenshell is None:
            raise RuntimeError("ifcopenshell non disponible")

        self.ifc = ifcopenshell.file(schema="IFC4")
        self._setup_project()

        niveaux_actifs = list(self.layout.get("rectangles", {}).keys())

        for niveau in niveaux_actifs:
            rects = self.layout["rectangles"].get(niveau, [])
            if not rects:
                continue

            elev = elevation_niveau(niveau, niveaux_actifs)
            hauteur = hauteur_niveau(niveau)
            storey = self._create_storey(niveau, elev)

            for rect in rects:
                self._generate_espace(rect, storey, niveau, elev, hauteur, rects)

            self._generate_dalle(rects, storey, elev)

        top_niveau = niveaux_actifs[-1] if niveaux_actifs else "rdc"
        top_elev = elevation_niveau(top_niveau, niveaux_actifs) + hauteur_niveau(top_niveau)
        rects_top = self.layout["rectangles"].get(top_niveau, [])
        if rects_top:
            storey_top = self.building
            self._generate_toiture(rects_top, top_elev)

        return self.ifc

    def _setup_project(self):
        self.project = self.ifc.createIfcProject(
            GlobalId=self._new_guid(),
            Name="Projet généré"
        )
        units = self.ifc.createIfcUnitAssignment([
            self.ifc.createIfcSIUnit(UnitType="LENGTHUNIT", Name="METRE"),
            self.ifc.createIfcSIUnit(UnitType="AREAUNIT", Name="SQUARE_METRE"),
            self.ifc.createIfcSIUnit(UnitType="VOLUMEUNIT", Name="CUBIC_METRE")
        ])
        self.project.UnitsInContext = units

        ctx = self.ifc.createIfcGeometricRepresentationContext(
            ContextType="Model",
            CoordinateSpaceDimension=3,
            Precision=1e-5,
            WorldCoordinateSystem=self.ifc.createIfcAxis2Placement3D(
                Location=self.ifc.createIfcCartesianPoint((0.0, 0.0, 0.0))
            )
        )
        self.context = ctx

        self.site = self.ifc.createIfcSite(
            GlobalId=self._new_guid(),
            Name="Site"
        )
        self.building = self.ifc.createIfcBuilding(
            GlobalId=self._new_guid(),
            Name="Bâtiment"
        )
        self.ifc.createIfcRelAggregates(
            GlobalId=self._new_guid(),
            RelatingObject=self.project,
            RelatedObjects=[self.site]
        )
        self.ifc.createIfcRelAggregates(
            GlobalId=self._new_guid(),
            RelatingObject=self.site,
            RelatedObjects=[self.building]
        )

    def _create_storey(self, niveau, elevation):
        labels = {"rdc": "Rez-de-chaussée", "etage": "Étage", "sous_sol": "Sous-sol"}
        storey = self.ifc.createIfcBuildingStorey(
            GlobalId=self._new_guid(),
            Name=labels.get(niveau, niveau),
            Elevation=elevation
        )
        self.ifc.createIfcRelAggregates(
            GlobalId=self._new_guid(),
            RelatingObject=self.building,
            RelatedObjects=[storey]
        )
        return storey

    def _generate_espace(self, rect, storey, niveau, elevation, hauteur, all_rects_niveau):
        pts_sol = [
            (rect["x"], rect["y"], elevation),
            (rect["x"] + rect["w"], rect["y"], elevation),
            (rect["x"] + rect["w"], rect["y"] + rect["h"], elevation),
            (rect["x"], rect["y"] + rect["h"], elevation)
        ]

        space = self.ifc.createIfcSpace(
            GlobalId=self._new_guid(),
            Name=rect.get("nom", rect["id"]),
            LongName=rect["id"]
        )
        self.ifc.createIfcRelContainedInSpatialStructure(
            GlobalId=self._new_guid(),
            RelatingStructure=storey,
            RelatedElements=[space]
        )

        walls = [
            ((pts_sol[0], pts_sol[1]), True),
            ((pts_sol[1], pts_sol[2]), True),
            ((pts_sol[2], pts_sol[3]), True),
            ((pts_sol[3], pts_sol[0]), True),
        ]

        for (p1, p2), _ in walls:
            is_ext = self._est_facade(rect, all_rects_niveau)
            self._create_wall(p1, p2, hauteur, elevation, storey, rect["id"], is_ext)

        return space

    def _create_wall(self, p1, p2, height, elevation, storey, space_id, is_exterior):
        dx = p2[0] - p1[0]
        dy = p2[1] - p1[1]
        length = math.sqrt(dx * dx + dy * dy)
        if length < 0.01:
            return None

        thickness = EPAISSEUR_MUR_EXT_M if is_exterior else EPAISSEUR_MUR_INT_M

        placement = self.ifc.createIfcLocalPlacement(
            RelativePlacement=self.ifc.createIfcAxis2Placement3D(
                Location=self.ifc.createIfcCartesianPoint((p1[0], p1[1], elevation)),
                Axis=self.ifc.createIfcDirection((0.0, 0.0, 1.0)),
                RefDirection=self.ifc.createIfcDirection((dx / length, dy / length, 0.0))
            )
        )

        profile = self.ifc.createIfcRectangleProfileDef(
            ProfileType="AREA",
            XDim=length,
            YDim=thickness
        )
        extrusion = self.ifc.createIfcExtrudedAreaSolid(
            SweptArea=profile,
            Position=self.ifc.createIfcAxis2Placement3D(
                Location=self.ifc.createIfcCartesianPoint((length / 2, thickness / 2, 0.0))
            ),
            ExtrudedDirection=self.ifc.createIfcDirection((0.0, 0.0, 1.0)),
            Depth=height
        )
        shape = self.ifc.createIfcShapeRepresentation(
            ContextOfItems=self.context,
            RepresentationIdentifier="Body",
            RepresentationType="SweptSolid",
            Items=[extrusion]
        )
        prod_repr = self.ifc.createIfcProductDefinitionShape(Representations=[shape])

        wall = self.ifc.createIfcWallStandardCase(
            GlobalId=self._new_guid(),
            ObjectPlacement=placement,
            Representation=prod_repr
        )
        self.ifc.createIfcRelContainedInSpatialStructure(
            GlobalId=self._new_guid(),
            RelatingStructure=storey,
            RelatedElements=[wall]
        )

        if is_exterior and length > 2.0:
            self._add_opening(wall, p1, p2, length, height, elevation, thickness)

        return wall

    def _add_opening(self, wall, p1, p2, length, height, elevation, thickness):
        opening_w = min(length * 0.4, 2.4)
        opening_x = (length - opening_w) / 2

        opening_placement = self.ifc.createIfcLocalPlacement(
            PlacementRelTo=wall.ObjectPlacement,
            RelativePlacement=self.ifc.createIfcAxis2Placement3D(
                Location=self.ifc.createIfcCartesianPoint((opening_x, 0.0, HAUTEUR_ALLEGE_M))
            )
        )
        opening_profile = self.ifc.createIfcRectangleProfileDef(
            ProfileType="AREA",
            XDim=opening_w,
            YDim=thickness + 0.1
        )
        opening_extrusion = self.ifc.createIfcExtrudedAreaSolid(
            SweptArea=opening_profile,
            Position=self.ifc.createIfcAxis2Placement3D(
                Location=self.ifc.createIfcCartesianPoint((opening_w / 2, (thickness + 0.1) / 2, 0.0))
            ),
            ExtrudedDirection=self.ifc.createIfcDirection((0.0, 0.0, 1.0)),
            Depth=HAUTEUR_BAIE_M
        )
        opening_shape = self.ifc.createIfcShapeRepresentation(
            ContextOfItems=self.context,
            RepresentationIdentifier="Body",
            RepresentationType="SweptSolid",
            Items=[opening_extrusion]
        )
        opening = self.ifc.createIfcOpeningElement(
            GlobalId=self._new_guid(),
            ObjectPlacement=opening_placement,
            Representation=self.ifc.createIfcProductDefinitionShape(Representations=[opening_shape])
        )
        self.ifc.createIfcRelVoidsElement(
            GlobalId=self._new_guid(),
            RelatingBuildingElement=wall,
            RelatedOpeningElement=opening
        )

    def _generate_dalle(self, rects, storey, elevation):
        for rect in rects:
            profile = self.ifc.createIfcRectangleProfileDef(
                ProfileType="AREA",
                XDim=rect["w"],
                YDim=rect["h"]
            )
            extrusion = self.ifc.createIfcExtrudedAreaSolid(
                SweptArea=profile,
                Position=self.ifc.createIfcAxis2Placement3D(
                    Location=self.ifc.createIfcCartesianPoint((rect["w"] / 2, rect["h"] / 2, 0.0))
                ),
                ExtrudedDirection=self.ifc.createIfcDirection((0.0, 0.0, 1.0)),
                Depth=EPAISSEUR_DALLE_M
            )
            shape = self.ifc.createIfcShapeRepresentation(
                ContextOfItems=self.context,
                RepresentationIdentifier="Body",
                RepresentationType="SweptSolid",
                Items=[extrusion]
            )
            placement = self.ifc.createIfcLocalPlacement(
                RelativePlacement=self.ifc.createIfcAxis2Placement3D(
                    Location=self.ifc.createIfcCartesianPoint((rect["x"], rect["y"], elevation - EPAISSEUR_DALLE_M))
                )
            )
            slab = self.ifc.createIfcSlab(
                GlobalId=self._new_guid(),
                ObjectPlacement=placement,
                Representation=self.ifc.createIfcProductDefinitionShape(Representations=[shape]),
                PredefinedType="FLOOR"
            )
            self.ifc.createIfcRelContainedInSpatialStructure(
                GlobalId=self._new_guid(),
                RelatingStructure=storey,
                RelatedElements=[slab]
            )

    def _generate_toiture(self, rects, elevation_top):
        if not rects:
            return
        min_x = min(r["x"] for r in rects)
        min_y = min(r["y"] for r in rects)
        max_x = max(r["x"] + r["w"] for r in rects)
        max_y = max(r["y"] + r["h"] for r in rects)

        w = max_x - min_x
        h = max_y - min_y

        profile = self.ifc.createIfcRectangleProfileDef(
            ProfileType="AREA",
            XDim=w,
            YDim=h
        )
        extrusion = self.ifc.createIfcExtrudedAreaSolid(
            SweptArea=profile,
            Position=self.ifc.createIfcAxis2Placement3D(
                Location=self.ifc.createIfcCartesianPoint((w / 2, h / 2, 0.0))
            ),
            ExtrudedDirection=self.ifc.createIfcDirection((0.0, 0.0, 1.0)),
            Depth=0.20
        )
        shape = self.ifc.createIfcShapeRepresentation(
            ContextOfItems=self.context,
            RepresentationIdentifier="Body",
            RepresentationType="SweptSolid",
            Items=[extrusion]
        )
        placement = self.ifc.createIfcLocalPlacement(
            RelativePlacement=self.ifc.createIfcAxis2Placement3D(
                Location=self.ifc.createIfcCartesianPoint((min_x, min_y, elevation_top))
            )
        )
        roof = self.ifc.createIfcRoof(
            GlobalId=self._new_guid(),
            ObjectPlacement=placement,
            Representation=self.ifc.createIfcProductDefinitionShape(Representations=[shape]),
            PredefinedType="FLAT_ROOF"
        )
        self.ifc.createIfcRelContainedInSpatialStructure(
            GlobalId=self._new_guid(),
            RelatingStructure=self.building,
            RelatedElements=[roof]
        )

    def _est_facade(self, rect, all_rects):
        adjacents = 0
        for other in all_rects:
            if other["id"] == rect["id"]:
                continue
            gap_x = abs(rect["x"] - (other["x"] + other["w"])) < 0.6 or abs(other["x"] - (rect["x"] + rect["w"])) < 0.6
            gap_y = abs(rect["y"] - (other["y"] + other["h"])) < 0.6 or abs(other["y"] - (rect["y"] + rect["h"])) < 0.6
            overlap_x = not (rect["x"] + rect["w"] < other["x"] or other["x"] + other["w"] < rect["x"])
            overlap_y = not (rect["y"] + rect["h"] < other["y"] or other["y"] + other["h"] < rect["y"])
            if (gap_x and overlap_y) or (gap_y and overlap_x):
                adjacents += 1
        return adjacents < 4

    def export_glb(self, output_glb, blender_path="blender"):
        ifc_path = str(output_glb).replace(".glb", ".ifc")
        self.ifc.write(ifc_path)

        script = f"""
import bpy
import sys

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()

bpy.ops.bim.load_project(filepath="{ifc_path}")

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath="{output_glb}", export_format='GLB', use_selection=True)
sys.exit(0)
"""
        script_path = str(output_glb).replace(".glb", "_export.py")
        Path(script_path).write_text(script)

        result = subprocess.run(
            [blender_path, "--background", "--python", script_path],
            capture_output=True, text=True, timeout=120
        )
        if result.returncode != 0:
            raise RuntimeError(f"Blender export échoué : {result.stderr[-500:]}")
        return output_glb

    @staticmethod
    def _new_guid():
        raw = uuid.uuid4().bytes
        chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$"
        result = []
        for i in range(22):
            idx = raw[i % 16] % 64
            result.append(chars[idx])
        return "".join(result)


def main():
    if len(sys.argv) < 3:
        print("Usage: python volumetry.py layout.json programme.json [output.ifc]")
        sys.exit(1)

    layout = json.loads(Path(sys.argv[1]).read_text())
    programme = json.loads(Path(sys.argv[2]).read_text())
    output = sys.argv[3] if len(sys.argv) > 3 else "output.ifc"

    gen = VolumetryGenerator(layout, programme)
    ifc_model = gen.generate()
    ifc_model.write(output)
    print(f"IFC écrit : {output}")


if __name__ == "__main__":
    main()

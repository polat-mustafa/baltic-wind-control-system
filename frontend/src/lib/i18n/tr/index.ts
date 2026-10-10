/**
 * Türkçe: English text → Turkish, split by area. Keys must match the rendered
 * text exactly (entities decoded, whitespace collapsed); `{name}` marks a
 * dynamic part (../index.ts). Later files win on a duplicate key. A new
 * language copies this folder and translates the values.
 */

import type { Dictionary } from "..";

import academy from "./academy";
import charts from "./charts";
import contentMisc from "./content-misc";
import design from "./design";
import eduLibrary from "./edu-library";
import eduP1 from "./edu-p1";
import eduP2 from "./edu-p2";
import eduParts from "./edu-parts";
import evidence from "./evidence";
import grid from "./grid";
import guides from "./guides";
import landing from "./landing";
import learn from "./learn";
import lifecycle from "./lifecycle";
import misc from "./misc";
import operate from "./operate";
import pages from "./pages";
import scada from "./scada";
import shell from "./shell";
import twin from "./twin";

// edu-*, guides and content-misc translate the content files (education panels, part cards,
// training guides, tours, drills); they are content, the others are UI text.
const tr: Dictionary = {
  ...eduP1,
  ...eduP2,
  ...eduLibrary,
  ...eduParts,
  ...guides,
  ...contentMisc,
  ...evidence,
  ...charts,
  ...academy,
  ...design,
  ...grid,
  ...landing,
  ...learn,
  ...lifecycle,
  ...misc,
  ...operate,
  ...pages,
  ...scada,
  ...twin,
  ...shell,
};

export default tr;

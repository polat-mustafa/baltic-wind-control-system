/**
 * Türkçe: English text → Turkish, split by area. Keys must match the rendered
 * text exactly (entities decoded, whitespace collapsed); `{name}` marks a
 * dynamic part (../index.ts). Later files win on a duplicate key. A new
 * language copies this folder and translates the values.
 */

import type { Dictionary } from "..";

import academy from "./academy";
import design from "./design";
import grid from "./grid";
import landing from "./landing";
import learn from "./learn";
import lifecycle from "./lifecycle";
import misc from "./misc";
import operate from "./operate";
import pages from "./pages";
import scada from "./scada";
import shell from "./shell";
import twin from "./twin";

const tr: Dictionary = { ...academy, ...design, ...grid, ...landing, ...learn, ...lifecycle, ...misc, ...operate, ...pages, ...scada, ...twin, ...shell };

export default tr;

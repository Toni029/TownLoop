/** Return the smallest scroll offset that exposes the field in the visible viewport. */
export function revealOffset(offset: number, top: number, height: number, keyboardTop: number, inputY: number, inputHeight: number) {
  const bottom = Math.min(top + height, keyboardTop) - 16;
  if (bottom <= top) return offset;
  const delta = inputY < top + 8 ? inputY - top - 8 : Math.min(inputY + inputHeight, inputY + bottom - top - 8) - bottom;
  return delta > 0 || inputY < top + 8 ? Math.max(0, offset + delta) : offset;
}

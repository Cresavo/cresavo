// Advance widths (1/1000 em) of the bundled poster fonts, read from their hmtx tables: Inter SemiBold and
// ExtraBold, Inter Display Black and Caladea Regular. They size and wrap text before Satori draws it.
// A test measures real renders against them, so a swapped font file shows up there.

const CHARS = " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~ ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ–—‘’“”…→·€•";

const ADVANCES = {
  semibold: "252 321 523 644 650 1004 663 326 373 373 540 673 319 465 319 379 660 423 623 636 666 629 640 576 640 640 319 329 673 673 673 543 999 728 659 737 722 605 588 749 746 277 580 703 565 922 759 769 645 773 652 650 660 736 728 1020 720 713 652 373 379 373 481 469 351 574 624 583 624 591 389 625 612 262 262 569 262 900 612 609 624 624 397 549 353 612 587 839 569 588 566 455 359 455 673 252 321 583 629 749 563 316 578 612 914 472 634 673 656 667 452 458 673 454 463 351 614 600 319 332 324 471 634 831 870 907 543 728 728 728 728 728 728 1013 737 605 605 605 605 277 277 277 277 751 759 769 769 769 769 769 673 769 736 736 736 736 713 658 644 574 574 574 574 574 574 913 583 591 591 591 591 262 262 262 262 594 612 609 609 609 609 609 673 609 612 612 612 612 588 624 588 500 1000 294 294 507 501 956 954 319 679 503",
  extrabold: "219 358 586 655 660 1029 683 354 382 382 583 686 353 471 353 400 692 441 638 657 688 652 662 588 664 662 353 360 686 686 686 579 1036 770 665 744 723 610 585 752 749 286 590 738 565 943 766 773 652 782 662 660 677 727 770 1059 761 752 679 382 400 382 493 484 382 588 638 595 638 601 410 639 635 283 283 593 283 927 635 619 638 638 420 573 382 635 615 863 594 618 581 486 388 486 686 219 358 595 650 776 579 367 605 635 914 498 691 686 656 662 423 461 686 467 482 382 646 597 353 403 345 495 691 863 895 935 579 770 770 770 770 770 770 1035 744 610 610 610 610 286 286 286 286 770 766 773 773 773 773 773 686 773 727 727 727 727 752 683 674 588 588 588 588 588 588 907 595 601 601 601 601 283 283 283 283 606 635 619 619 619 619 619 686 619 635 635 635 635 618 638 618 500 1000 331 331 581 569 1058 954 353 692 438",
  black: "184 270 531 646 685 1018 680 286 359 359 593 678 266 459 266 396 682 413 630 638 690 618 646 579 642 646 266 267 678 678 678 604 1035 764 650 729 711 632 605 740 727 281 585 729 575 925 738 746 648 746 666 685 656 705 750 1037 741 730 652 359 396 359 484 493 341 583 625 583 625 583 426 625 618 279 280 587 279 922 618 607 625 625 416 559 418 618 590 875 563 590 561 486 390 486 678 184 270 583 634 777 572 382 605 618 898 497 698 678 656 644 375 447 678 406 413 341 636 580 266 431 274 493 698 846 875 939 604 764 764 764 764 764 764 1058 729 632 632 632 632 281 281 281 281 771 738 746 746 746 746 746 678 746 705 705 705 705 730 682 678 583 583 583 583 583 583 896 583 583 583 583 583 279 279 279 279 598 618 607 607 607 607 607 678 607 618 618 618 618 590 626 590 500 1000 257 257 513 499 797 938 266 685 367",
  serif: "220 286 393 619 506 890 687 237 382 382 427 554 205 329 206 490 517 362 472 461 492 475 470 470 485 478 264 264 554 554 554 422 885 599 579 519 625 540 509 539 696 343 304 630 501 888 693 599 533 599 613 453 557 687 598 889 571 557 507 350 490 350 554 371 151 470 520 421 520 441 313 459 554 277 255 525 271 813 558 480 520 501 396 392 325 546 470 720 483 482 428 387 316 387 712 220 286 441 528 544 609 316 500 261 851 417 491 554 332 851 278 375 554 407 407 151 544 588 106 285 407 428 491 829 867 866 422 599 599 599 599 599 599 866 519 540 540 540 540 343 343 343 343 662 693 599 599 599 599 599 554 653 687 687 687 687 557 574 605 470 470 470 470 470 470 708 421 441 441 441 441 277 277 277 277 530 558 480 480 480 480 480 554 490 546 546 546 546 482 547 482 500 1000 221 221 375 375 752 783 106 628 443",
};

export type PosterFont = keyof typeof ADVANCES;

const TABLE = Object.fromEntries(Object.entries(ADVANCES).map(([font, row]) => {
  const widths = row.split(" ").map(Number);
  return [font, new Map(Array.from(CHARS, (char, i) => [char, widths[i]]))];
})) as Record<PosterFont, Map<string, number>>;

/** A character the table does not know (an emoji, say) counts as a wide one, so an estimate errs on the safe side. */
const UNKNOWN = 800;

/** The width in pixels of `text` on one line; `spacing` is the letter spacing in pixels. */
export function textWidth(text: string, font: PosterFont, size: number, spacing = 0): number {
  return Array.from(text).reduce((sum, char) => sum + ((TABLE[font].get(char) ?? UNKNOWN) * size) / 1000 + spacing, 0);
}

/** The lines `text` breaks into at spaces within `room` pixels, as Satori breaks them. A word wider than `room` stays whole on its own line. */
export function wrapText(text: string, font: PosterFont, size: number, room: number, spacing = 0): string[] {
  const lines: string[] = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const last = lines.length - 1;
    if (last >= 0 && textWidth(`${lines[last]} ${word}`, font, size, spacing) <= room) lines[last] += ` ${word}`;
    else lines.push(word);
  }
  return lines;
}

export interface FitOptions {
  text: string;
  font: PosterFont;
  room: number;
  /** The largest size, and the readable floor: the size only goes below it when the longest word would not fit the room otherwise. */
  max: number;
  floor: number;
  lineHeight: number;
  maxLines?: number;
  maxHeight?: number;
  /** Letter spacing in em, so it grows and shrinks with the size. */
  tracking?: number;
}

/**
 * The largest size from `max` down to `floor` at which `text` wraps into at most `maxLines` lines that stay within
 * `maxHeight`, with no word wider than `room`. When none does, the size is the floor (smaller only for a word that
 * would run off the poster) and `lines` is the number of lines that fit, for the caller to clamp with an ellipsis.
 */
export function fitText({ text, font, room, max, floor, lineHeight, maxLines = Infinity, maxHeight = Infinity, tracking = 0 }: FitOptions): { size: number; lines: number; spacing: number } {
  const words = text.split(/\s+/).filter(Boolean);
  const spacingAt = (size: number) => Math.round(tracking * size * 10) / 10;
  const wordsFit = (size: number) => words.every((word) => textWidth(word, font, size, spacingAt(size)) <= room);
  const linesAt = (size: number) => wrapText(text, font, size, room, spacingAt(size)).length;
  for (let size = Math.floor(max); size >= floor; size -= 2) {
    if (wordsFit(size) && linesAt(size) <= maxLines && linesAt(size) * size * lineHeight <= maxHeight) return { size, lines: linesAt(size), spacing: spacingAt(size) };
  }
  let size = floor;
  while (size > 1 && !wordsFit(size)) size--;
  return { size, lines: Math.max(1, Math.min(maxLines, Math.floor(maxHeight / (size * lineHeight)), linesAt(size))), spacing: spacingAt(size) };
}

// Advance widths (1/1000 em) of the bundled poster fonts, read from their hmtx tables: Inter SemiBold and
// ExtraBold, Inter Display Black and Caladea Regular. They size and wrap text before Satori draws it.
// A test measures real renders against them, so a swapped font file shows up there.

const CHARS = " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~ ¡¢£¤¥¦§¨©ª«¬­®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿĀāĂăĄąĆćĈĉĊċČčĎďĐđĒēĔĕĖėĘęĚěĜĝĞğĠġĢģĤĥĦħĨĩĪīĬĭĮįİıĲĳĴĵĶķĸĹĺĻļĽľĿŀŁłŃńŅņŇňŉŊŋŌōŎŏŐőŒœŔŕŖŗŘřŚśŜŝŞşŠšŢţŤťŦŧŨũŪūŬŭŮůŰűŲųŴŵŶŷŸŹźŻżŽžſ–—‘’“”…→·€•™";

const ADVANCES = {
  semibold: "252 321 523 644 650 1004 663 326 373 373 540 673 319 465 319 379 660 423 623 636 666 629 640 576 640 640 319 329 673 673 673 543 999 728 659 737 722 605 588 749 746 277 580 703 565 922 759 769 645 773 652 650 660 736 728 1020 720 713 652 373 379 373 481 469 351 574 624 583 624 591 389 625 612 262 262 569 262 900 612 609 624 624 397 549 353 612 587 839 569 588 566 455 359 455 673 252 321 583 629 749 563 316 578 612 914 472 634 673 656 667 452 458 673 454 463 351 614 600 319 332 324 471 634 831 870 907 543 728 728 728 728 728 728 1013 737 605 605 605 605 277 277 277 277 751 759 769 769 769 769 769 673 769 736 736 736 736 713 658 644 574 574 574 574 574 574 913 583 591 591 591 591 262 262 262 262 594 612 609 609 609 609 609 673 609 612 612 612 612 588 624 588 728 574 728 574 728 574 737 583 737 583 737 583 737 583 722 739 722 624 605 591 605 591 605 591 605 591 605 591 749 625 749 625 749 625 749 625 746 612 797 612 277 262 277 262 277 262 277 262 277 262 856 523 580 262 703 569 566 565 262 565 262 565 377 573 419 602 262 759 612 759 612 759 612 656 759 612 769 609 769 609 769 609 1014 992 652 397 652 397 652 397 650 549 650 549 650 549 650 549 660 353 660 419 660 353 736 612 736 612 736 612 736 612 736 612 736 612 1020 839 713 588 713 652 566 652 566 652 566 334 500 1000 294 294 507 501 956 954 319 679 503 656",
  extrabold: "219 358 586 655 660 1029 683 354 382 382 583 686 353 471 353 400 692 441 638 657 688 652 662 588 664 662 353 360 686 686 686 579 1036 770 665 744 723 610 585 752 749 286 590 738 565 943 766 773 652 782 662 660 677 727 770 1059 761 752 679 382 400 382 493 484 382 588 638 595 638 601 410 639 635 283 283 593 283 927 635 619 638 638 420 573 382 635 615 863 594 618 581 486 388 486 686 219 358 595 650 776 579 367 605 635 914 498 691 686 656 662 423 461 686 467 482 382 646 597 353 403 345 495 691 863 895 935 579 770 770 770 770 770 770 1035 744 610 610 610 610 286 286 286 286 770 766 773 773 773 773 773 686 773 727 727 727 727 752 683 674 588 588 588 588 588 588 907 595 601 601 601 601 283 283 283 283 606 635 619 619 619 619 619 686 619 635 635 635 635 618 638 618 770 588 770 588 770 588 744 595 744 595 744 595 744 595 723 772 723 638 610 601 610 601 610 601 610 601 610 601 752 639 752 639 752 639 752 639 749 635 819 635 286 283 286 283 286 283 286 283 286 283 875 566 590 283 738 593 611 565 283 565 283 565 418 584 485 609 283 766 635 766 635 766 635 656 766 635 773 619 773 619 773 619 1023 983 662 420 662 420 662 420 660 573 660 573 660 573 660 573 677 382 677 468 677 382 727 635 727 635 727 635 727 635 727 635 727 635 1059 863 752 618 752 679 581 679 581 679 581 357 500 1000 331 331 581 569 1058 954 353 692 438 656",
  black: "184 270 531 646 685 1018 680 286 359 359 593 678 266 459 266 396 682 413 630 638 690 618 646 579 642 646 266 267 678 678 678 604 1035 764 650 729 711 632 605 740 727 281 585 729 575 925 738 746 648 746 666 685 656 705 750 1037 741 730 652 359 396 359 484 493 341 583 625 583 625 583 426 625 618 279 280 587 279 922 618 607 625 625 416 559 418 618 590 875 563 590 561 486 390 486 678 184 270 583 634 777 572 382 605 618 898 497 698 678 656 644 375 447 678 406 413 341 636 580 266 431 274 493 698 846 875 939 604 764 764 764 764 764 764 1058 729 632 632 632 632 281 281 281 281 771 738 746 746 746 746 746 678 746 705 705 705 705 730 682 678 583 583 583 583 583 583 896 583 583 583 583 583 279 279 279 279 598 618 607 607 607 607 607 678 607 618 618 618 618 590 626 590 764 583 764 583 764 583 729 583 729 583 729 583 729 583 711 771 711 625 632 583 632 583 632 583 632 583 632 583 740 625 740 625 740 625 740 625 727 618 817 618 281 279 281 279 281 279 281 279 281 279 867 560 585 280 729 587 616 575 279 575 279 575 426 575 494 624 279 738 618 738 618 738 618 656 738 618 746 607 746 607 746 607 1062 954 666 416 666 416 666 416 685 559 685 559 685 559 685 559 656 418 656 516 656 418 705 618 705 618 705 618 705 618 705 618 705 618 1037 875 730 590 730 652 561 652 561 652 561 344 500 1000 257 257 513 499 797 938 266 685 367 656",
  serif: "220 286 393 619 506 890 687 237 382 382 427 554 205 329 206 490 517 362 472 461 492 475 470 470 485 478 264 264 554 554 554 422 885 599 579 519 625 540 509 539 696 343 304 630 501 888 693 599 533 599 613 453 557 687 598 889 571 557 507 350 490 350 554 371 151 470 520 421 520 441 313 459 554 277 255 525 271 813 558 480 520 501 396 392 325 546 470 720 483 482 428 387 316 387 712 220 286 441 528 544 609 316 500 261 851 417 491 554 332 851 278 375 554 407 407 151 544 588 106 285 407 428 491 829 867 866 422 599 599 599 599 599 599 866 519 540 540 540 540 343 343 343 343 662 693 599 599 599 599 599 554 653 687 687 687 687 557 574 605 470 470 470 470 470 470 708 421 441 441 441 441 277 277 277 277 530 558 480 480 480 480 480 554 490 546 546 546 546 482 547 482 599 470 599 470 623 470 519 421 519 421 519 421 519 421 625 568 662 555 540 441 540 441 540 441 540 441 540 441 539 459 539 459 539 459 539 459 696 554 691 552 343 277 343 277 343 277 343 287 343 277 647 544 304 255 630 525 528 501 271 501 271 501 294 501 284 540 309 693 558 693 558 693 558 558 681 551 599 480 599 480 599 480 929 771 613 396 613 396 613 396 453 392 453 392 453 392 453 392 617 617 557 325 557 338 687 546 687 546 687 546 687 546 687 546 687 546 889 720 557 482 557 507 428 507 428 507 428 279 500 1000 221 221 375 375 752 783 106 628 443 617",
};

export type PosterFont = keyof typeof ADVANCES;

const TABLE = Object.fromEntries(Object.entries(ADVANCES).map(([font, row]) => {
  const widths = row.split(" ").map(Number);
  return [font, new Map(Array.from(CHARS, (char, i) => [char, widths[i]]))];
})) as Record<PosterFont, Map<string, number>>;

/** A character the table does not know (an emoji, say) counts as a full em, so an estimate errs on the safe side. */
const UNKNOWN = 1000;

/** The width in pixels of `text` on one line; `spacing` is the letter spacing in pixels. */
export function textWidth(text: string, font: PosterFont, size: number, spacing = 0): number {
  return Array.from(text).reduce((sum, char) => sum + ((TABLE[font].get(char) ?? UNKNOWN) * size) / 1000 + spacing, 0);
}

/** Text with every no-break or narrow space made an ordinary one: Satori keeps a no-break space on one line, a plain split does not. */
export const normalSpaces = (value: string) => value.replace(/[    ]/g, " ");

/** The words of `text`, each cut after its hyphens, because Satori may break a line there. */
const pieces = (text: string) => text.split(/\s+/).filter(Boolean).map((word) => word.split(/(?<=-)(?=[^-])/));

/** The lines `text` breaks into at spaces and after hyphens within `room` pixels, as Satori breaks them. A piece wider than `room` stays whole on its own line. */
export function wrapText(text: string, font: PosterFont, size: number, room: number, spacing = 0): string[] {
  const lines: string[] = [];
  for (const word of pieces(text)) {
    word.forEach((piece, index) => {
      const last = lines.length - 1;
      const joined = index === 0 ? `${lines[last]} ${piece}` : `${lines[last]}${piece}`;
      if (last >= 0 && textWidth(joined, font, size, spacing) <= room) lines[last] = joined;
      else lines.push(piece);
    });
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
  /** The text stays on one line whatever it holds (a price, a button): the whole string must fit, not each word. */
  oneLine?: boolean;
}

/** How far above its line box a capital's accent (Å, Ä, Ö) reaches, in em, at the tight line heights big headlines use. */
const ACCENT_RISE = { black: 0.2, serif: 0.08, extrabold: 0.12, semibold: 0.12 } as const;
export const accentRise = (font: PosterFont, size: number) => Math.ceil(ACCENT_RISE[font] * size);

/** A fit must leave this share of the room free, since kerning and rounding can go either way. */
const SAFETY = 0.95;

/**
 * The largest size from `max` down to `floor` at which `text` wraps into at most `maxLines` lines that stay within
 * `maxHeight`, with no word wider than `room` (and 5 % to spare). When none does, the size goes below the floor, to at most
 * 70 % of it, until the whole text fits (further only for a word that would run off the poster); `lines` is the number of
 * lines that fit, for the caller to clamp with an ellipsis when even that is not enough.
 */
export function fitText({ text, font, room, max, floor, lineHeight, maxLines = Infinity, maxHeight = Infinity, tracking = 0, oneLine = false }: FitOptions): { size: number; lines: number; spacing: number } {
  const parts = oneLine ? [text] : pieces(text).flat();
  const spacingAt = (size: number) => Math.round(tracking * size * 10) / 10;
  const wordsFit = (size: number) => parts.every((part) => textWidth(part, font, size, spacingAt(size)) <= room * SAFETY);
  const linesAt = (size: number) => (oneLine ? 1 : wrapText(text, font, size, room, spacingAt(size)).length);
  for (let size = Math.floor(max); size >= floor; size -= 2) {
    if (wordsFit(size) && linesAt(size) <= maxLines && linesAt(size) * size * lineHeight <= maxHeight) return { size, lines: linesAt(size), spacing: spacingAt(size) };
  }
  let size = floor;
  while (size > 1 && !wordsFit(size)) size--;
  // Whole words beat an ellipsis: when the text needs more lines than allowed, keep shrinking, down to 70 % of the floor.
  const fits = (at: number) => linesAt(at) <= maxLines && linesAt(at) * at * lineHeight <= maxHeight;
  for (let smaller = size - 1; !fits(size) && smaller >= Math.floor(floor * 0.7); smaller--) if (wordsFit(smaller)) size = smaller;
  return { size, lines: Math.max(1, Math.min(maxLines, Math.floor(maxHeight / (size * lineHeight)), linesAt(size))), spacing: spacingAt(size) };
}

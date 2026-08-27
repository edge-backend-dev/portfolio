/**
 * The three-ring heart that rides the right end of the Android home's Start
 * widget. Drawn as vector paths rather than shipped as the source PNG so the
 * curves and the "Start" label beside them stay sharp at any zoom or pixel
 * density — the label is real DOM text in the shell's own font, and this is
 * real geometry.
 *
 * The paths are not hand-drawn. They were traced numerically from
 * public/greet/start.png: the artwork's three ring bands were separated by
 * hue, mirrored about their shared symmetry axis (x = 486.75) to rebuild the
 * halves the pill crops away, and each band's outer and inner boundary was fit
 * with least-squares cubics to a tolerance of 1.8px in the PNG's own 592x285
 * coordinates. The result tracks the source to a mean boundary error of about
 * 0.75px there, which is a fifth of a pixel at the size the widget renders.
 * Coordinates below are therefore in source pixels, and the viewBox is the
 * pill's own rect in that space.
 *
 * The bands are filled, not stroked, so each is one path holding its outer
 * boundary followed by its inner one under fill-rule="evenodd". The gaps
 * between rings are left open rather than painted black, so the pill's own
 * surface shows through and the mark works on the light pill as well as the
 * dark one.
 *
 * preserveAspectRatio="xMaxYMid meet" is what makes it responsive: the widget
 * is wider than the source artwork, so the art scales to the pill's height and
 * anchors to its right edge, and everything past the viewBox — the outer
 * ring's lower point, the right of each lobe — is clipped by the pill exactly
 * as it is in the source.
 */
export default function StartMark() {
  return (
    <svg
      className="and-start-art"
      viewBox="2 3 587 270"
      preserveAspectRatio="xMaxYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* Each ring carries its own vertical gradient over its own extent,
            sampled from the source at five points because the ramps are not
            linear — they slow toward the bottom. */}
        <linearGradient id="and-start-g" x1="0" y1="18" x2="0" y2="273" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#b1e157" />
          <stop offset="0.25" stopColor="#98dc4e" />
          <stop offset="0.5" stopColor="#7acd43" />
          <stop offset="0.75" stopColor="#66c23d" />
          <stop offset="1" stopColor="#5cba38" />
        </linearGradient>
        <linearGradient id="and-start-b" x1="0" y1="53" x2="0" y2="273" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#66c5d6" />
          <stop offset="0.25" stopColor="#56ace2" />
          <stop offset="0.5" stopColor="#4897df" />
          <stop offset="0.75" stopColor="#3d87dc" />
          <stop offset="1" stopColor="#377eda" />
        </linearGradient>
        <linearGradient id="and-start-p" x1="0" y1="90" x2="0" y2="273" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#c891f7" />
          <stop offset="0.25" stopColor="#b36af7" />
          <stop offset="0.5" stopColor="#a44ef7" />
          <stop offset="0.75" stopColor="#993df6" />
          <stop offset="1" stopColor="#9230f5" />
        </linearGradient>
      </defs>

      <path
        fill="url(#and-start-g)"
        fillRule="evenodd"
        d="M486.75 19.99C452.55 17.97 413.98 17.89 385.35 36.70C346.47 62.26 311.41 109.69 313.20
          156.18C314.16 181.18 317.63 208.05 331.28 229.02C348.20 255.00 369.74 277.69 389.74
          301.39C411.31 326.97 432.95 352.48 454.56 378.03C460.80 385.41 467.03 392.81 473.30
          400.17C475.70 402.99 476.82 408.38 480.52 408.65C482.60 408.80 485.16 407.76 486.75
          409.11C488.34 407.76 490.90 408.80 492.98 408.65C496.68 408.38 497.80 402.99 500.20
          400.17C506.47 392.81 512.70 385.41 518.94 378.03C540.55 352.48 562.19 326.97 583.76
          301.39C603.76 277.69 625.30 255.00 642.22 229.02C655.87 208.05 659.34 181.18 660.30
          156.18C662.09 109.69 627.03 62.26 588.15 36.70C559.52 17.89 520.95 17.97 486.75
          19.99ZM486.75 47.41C456.65 44.18 421.91 43.67 396.92 60.75C364.69 82.77 335.52 123.98 339.52
          162.81C342.68 193.49 356.52 224.88 378.11 246.91C385.61 254.57 391.40 265.99 401.77
          268.70C429.20 275.87 458.40 272.00 486.75 272.00C515.10 272.00 544.30 275.87 571.73
          268.70C582.10 265.99 587.89 254.57 595.39 246.91C616.98 224.88 630.82 193.49 633.98
          162.81C637.98 123.98 608.81 82.77 576.58 60.75C551.59 43.67 516.85 44.18 486.75 47.41Z"
      />
      <path
        fill="url(#and-start-b)"
        fillRule="evenodd"
        d="M486.75 56.98C460.86 53.54 431.45 51.28 408.72 64.15C376.69 82.27 346.68 119.86 348.41
          156.63C349.33 176.39 352.69 197.62 363.87 213.95C380.34 238.01 402.46 257.82 423.97
          277.51C437.38 289.77 450.63 302.20 463.95 314.55C468.12 318.41 472.25 322.29 476.45
          326.11C478.13 327.64 479.22 330.55 481.48 330.69C483.24 330.80 485.28 330.04 486.75
          331.01C488.22 330.04 490.26 330.80 492.02 330.69C494.28 330.55 495.37 327.64 497.05
          326.11C501.25 322.29 505.38 318.41 509.55 314.55C522.87 302.20 536.12 289.77 549.53
          277.51C571.04 257.82 593.16 238.01 609.63 213.95C620.81 197.62 624.17 176.39 625.09
          156.63C626.82 119.86 596.81 82.27 564.78 64.15C542.05 51.28 512.64 53.54 486.75
          56.98ZM486.75 85.37C465.93 81.18 441.83 77.11 423.05 87.04C398.77 99.89 375.15 126.72 375.26
          154.20C375.32 168.67 377.05 184.30 384.74 196.57C393.62 210.75 404.89 223.49 417.02
          235.02C426.38 243.92 436.08 252.52 446.45 260.21C451.14 263.68 455.34 268.68 461.05
          269.89C469.45 271.69 478.15 271.88 486.75 272.00C495.35 271.88 504.05 271.69 512.45
          269.89C518.16 268.68 522.36 263.68 527.05 260.21C537.42 252.52 547.12 243.92 556.48
          235.02C568.61 223.49 579.88 210.75 588.76 196.57C596.45 184.30 598.18 168.67 598.24
          154.20C598.35 126.72 574.73 99.89 550.45 87.04C531.67 77.11 507.57 81.18 486.75 85.37Z"
      />
      <path
        fill="url(#and-start-p)"
        fillRule="evenodd"
        d="M486.75 95.54C467.86 91.36 446.16 86.48 428.72 94.85C406.02 105.75 383.82 130.89 384.43
          156.07C385.14 185.94 405.99 214.45 428.47 234.12C437.36 241.91 446.23 249.81 455.99
          256.48C461.04 259.93 465.62 264.91 471.63 266.08C476.61 267.04 481.71 267.28 486.75
          267.88C491.79 267.28 496.89 267.04 501.87 266.08C507.88 264.91 512.46 259.93 517.51
          256.48C527.27 249.81 536.14 241.91 545.03 234.12C567.51 214.45 588.36 185.94 589.07
          156.07C589.68 130.89 567.48 105.75 544.78 94.85C527.34 86.48 505.64 91.36 486.75
          95.54ZM486.75 126.45C473.61 122.25 459.50 113.92 446.27 117.82C430.02 122.60 411.95 137.85
          411.41 154.77C410.79 174.31 425.52 192.52 439.34 206.34C453.36 220.36 468.69 234.08 486.75
          242.26C504.81 234.08 520.14 220.36 534.16 206.34C547.98 192.52 562.71 174.31 562.09
          154.77C561.55 137.85 543.48 122.60 527.23 117.82C514.00 113.92 499.89 122.25 486.75 126.45Z"
      />
    </svg>
  );
}

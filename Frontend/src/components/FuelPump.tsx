type FuelPumpProps = {
  fill: string
}

function FuelPump({ fill }: FuelPumpProps) {
  return (
    <svg
      className="pump"
      viewBox="0 0 72 88"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="6" y="8" width="42" height="62" rx="6" fill={fill} stroke="#111" strokeWidth="2.8" />
      <rect x="14" y="16" width="26" height="14" rx="2.5" fill="#1b2430" stroke="#111" strokeWidth="1.8" />
      <path
        d="M33.5 42.5c0-4.2-3.2-7-6.5-7s-6.5 2.8-6.5 7c0 5.2 6.5 10.5 6.5 10.5s6.5-5.3 6.5-10.5Z"
        fill="#111"
      />
      <rect x="10" y="72" width="34" height="10" rx="2.5" fill={fill} stroke="#111" strokeWidth="2.8" />
      <path
        d="M48 18h8c5 0 9 4 9 9v22c0 3.6 2.4 6 6 6"
        stroke="#111"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="71" cy="55" r="3.4" fill={fill} stroke="#111" strokeWidth="2.2" />
    </svg>
  )
}

export default FuelPump

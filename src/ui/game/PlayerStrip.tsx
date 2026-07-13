const USER_PATH =
  'M230.92,212c-15.23-26.33-38.7-45.21-66.09-54.16a72,72,0,1,0-73.66,0C63.78,166.78,40.31,185.66,25.08,212a8,8,0,1,0,13.85,8c18.84-32.56,52.14-52,89.07-52s70.23,19.44,89.07,52a8,8,0,1,0,13.85-8ZM72,96a56,56,0,1,1,56,56A56.06,56.06,0,0,1,72,96Z'

export function PlayerStrip({
  variant,
  name,
  sub,
  clock,
  active,
}: {
  variant: 'opp' | 'you'
  name: string
  sub: string
  clock: string
  active?: boolean
}) {
  return (
    <div className="player">
      <div
        className="avatar"
        style={variant === 'you' ? { color: 'var(--color-accent)' } : undefined}
      >
        {variant === 'you' ? (
          <svg
            width="20"
            height="20"
            viewBox="0 0 256 256"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d={USER_PATH} />
          </svg>
        ) : (
          '✳'
        )}
      </div>
      <div className="who">
        <b>{name}</b>
        <small>{sub}</small>
      </div>
      <div className="captured" />
      <div className={`clock${active ? ' active' : ''}`}>{clock}</div>
    </div>
  )
}

type ConnectedViewProps = {
  baseUrl: string
  activeModel: string
  onChange: () => void
}

export function ConnectedView({
  baseUrl,
  activeModel,
  onChange,
}: ConnectedViewProps) {
  return (
    <div>
      <h1>LM Chess</h1>
      <p>
        Using <strong>{activeModel}</strong>
      </p>
      <p>Connected to {baseUrl}</p>
      <button type="button" onClick={onChange}>
        Change
      </button>
    </div>
  )
}

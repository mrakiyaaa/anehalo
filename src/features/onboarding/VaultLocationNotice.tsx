export function VaultLocationNotice({ path }: { path: string }) {
  return (
    <div>
      <p>
        Your notes will be saved in <span className="settings-path">{path}</span>
      </p>
      <p>Anehalo creates its own folder here and never touches your other files.</p>
    </div>
  );
}

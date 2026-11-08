const paths: Record<string, React.ReactNode> = {
  home: <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-8H9v8H4a1 1 0 0 1-1-1Z" />,
  chat: <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />,
  calendar: <><rect x="4" y="4" width="16" height="17" rx="2" /><path d="M4 9h16M8 2v4m8-4v4M8 13h1m3 0h1m3 0h1m-9 4h1m3 0h1" /></>,
  inbox: <><path d="M5 4h14l3 11v6H2v-6ZM2 15h6l2 3h4l2-3h6" /><path d="M8 8h8m-8 3h8" /></>,
  search: <><circle cx="10.5" cy="10.5" r="7.5" /><path d="m16 16 6 6" /></>,
  board: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M2 10h20M2 15h20M9 4v16" /></>,
  person: <><circle cx="12" cy="6" r="4" /><path d="M5 22v-3a7 7 0 0 1 14 0v3Z" /></>,
  sprint: <><circle cx="15" cy="4" r="2" /><path d="m8 22 4-7-4-4 4-4 4 5 5 1M3 13l3-6 5-1m3 9 4 3-1 5" /></>,
  timeline: <><rect x="2" y="5" width="20" height="15" rx="2" /><path d="M6 9h9m-9 4h12m-12 3h6" /></>,
  sort: <path d="M8 20V4m-4 4 4-4 4 4m4-4v16m-4-4 4 4 4-4" />,
  filter: <path d="M3 6h18M6 12h12M9 18h6" />, bolt: <path d="m13 2-8 12h6l-1 8 9-13h-7Z" />,
  expand: <path d="M14 3h7v7m0-7-7 7M3 14v7h7m-7 0 7-7" />,
  sliders: <><path d="M3 7h7m4 0h7M3 17h12m4 0h2" /><circle cx="12" cy="7" r="2" /><circle cx="17" cy="17" r="2" /></>,
  star: <path d="m12 2 3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1Z" />,
  more: <><circle cx="4" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="20" cy="12" r="1" /></>,
  plus: <path d="M12 4v16M4 12h16" />, chevron: <path d="m5 9 7 7 7-7" />,
  team: <><circle cx="8" cy="7" r="3" /><circle cx="18" cy="7" r="3" /><path d="M1 21v-4a7 7 0 0 1 14 0v4m1-8a6 6 0 0 1 7 6v2" /></>,
  laptop: <path d="M4 3h16v14H4Z M1 21h22M2 18h20" />,
  gear: <><circle cx="12" cy="12" r="5" /><path d="M12 1v5m0 12v5M1 12h5m12 0h5M4 4l4 4m8 8 4 4M4 20l4-4m8-8 4-4" /></>,
  notes: <path d="M5 2h14v17H5Zm-3 4v16h14" />, scissors: <><circle cx="6" cy="18" r="3" /><circle cx="18" cy="18" r="3" /><path d="m5 2 13 13M19 2 6 15" /></>,
  close: <path d="m5 5 14 14M5 19 19 5" />,
}
export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] ?? paths.more}</svg>
}

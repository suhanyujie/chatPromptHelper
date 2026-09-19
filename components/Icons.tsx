import type { ReactNode } from 'react';

interface IconProps {
  size?: number;
}

function Svg({ size = 14, children }: IconProps & { children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

export function EditIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        fill="currentColor"
        d="M2 11.5V14h2.5l7.37-7.37-2.5-2.5L2 11.5zm11.8-6.9a.66.66 0 0 0 0-.94l-1.46-1.46a.66.66 0 0 0-.94 0l-1.15 1.15 2.5 2.5 1.05-1.25z"
      />
    </Svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        fill="currentColor"
        d="M6.2 1.8h3.6v1h3.4v1.4H2.8V2.8h3.4v-1zM4 5.6h8l-.62 8.1a1.1 1.1 0 0 1-1.1 1H5.72a1.1 1.1 0 0 1-1.1-1L4 5.6z"
      />
    </Svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 8.4l3.4 3.4L13 5"
      />
    </Svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        d="M4 4l8 8M12 4l-8 8"
      />
    </Svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 3l5 5-5 5"
      />
    </Svg>
  );
}

export function GearIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        fill="currentColor"
        d="M8 5.4a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2zm0 4a1.4 1.4 0 1 1 0-2.8 1.4 1.4 0 0 1 0 2.8z"
      />
      <path
        fill="currentColor"
        d="M13.6 8c0-.35-.03-.69-.1-1.02l1.2-.9-1.3-2.25-1.4.55a5.6 5.6 0 0 0-1.77-1.02L10 1.9H7.4l-.23 1.46c-.65.22-1.25.57-1.77 1.02l-1.4-.55L2.7 6.08l1.2.9a5.7 5.7 0 0 0 0 2.04l-1.2.9 1.3 2.25 1.4-.55c.52.45 1.12.8 1.77 1.02l.23 1.46H10l.23-1.46c.65-.22 1.25-.57 1.77-1.02l1.4.55 1.3-2.25-1.2-.9c.07-.33.1-.67.1-1.02zm-1.28 1.5.9.67-.42.73-1.06-.42-.44.42c-.45.43-1 .75-1.6.92l-.59.17-.17 1.11h-.88l-.17-1.11-.59-.17a4.4 4.4 0 0 1-1.6-.92l-.44-.42-1.06.42-.42-.73.9-.67-.1-.6a4.5 4.5 0 0 1 0-1.4l.1-.6-.9-.67.42-.73 1.06.42.44-.42c.45-.43 1-.75 1.6-.92l.59-.17.17-1.11h.88l.17 1.11.59.17c.6.17 1.15.49 1.6.92l.44.42 1.06-.42.42.73-.9.67.1.6a4.5 4.5 0 0 1 0 1.4l-.1.6z"
      />
    </Svg>
  );
}

type SchoolLogoProps = {
  alt?: string;
  className?: string;
  size?: "small" | "medium";
  testId?: string;
};

export function SchoolLogo({
  alt = "RESA crest",
  className = "",
  size = "medium",
  testId,
}: SchoolLogoProps) {
  const dimension = size === "small" ? 40 : 48;

  return (
    <img
      src={`${import.meta.env.BASE_URL}media/logo/resa-logo.jpg`}
      alt={alt}
      className={className}
      width={dimension}
      height={dimension}
      data-testid={testId}
    />
  );
}

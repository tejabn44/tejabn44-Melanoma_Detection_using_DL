function Tooltip({ text }) {
  return (
    <span className="tooltip" title={text} aria-label={text}>
      i
    </span>
  );
}

export default Tooltip;

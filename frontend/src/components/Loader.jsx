function Loader({ text = "Analyzing lesion image..." }) {
  return (
    <div className="loader-wrap">
      <div className="spinner" />
      <p>{text}</p>
    </div>
  );
}

export default Loader;

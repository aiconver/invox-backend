import app from "./app";
import { config } from "./config/env";

const PORT = parseInt(config.PORT, 10) || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});

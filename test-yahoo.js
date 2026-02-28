try {
  const yahoo = require('next-auth/providers/yahoo');
  console.log("Yahoo provider exists!", !!yahoo);
} catch(e) {
  console.log("No Yahoo provider");
}

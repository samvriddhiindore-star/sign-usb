import { storage } from "../server/storage";

async function testProfileCreation() {
  try {
    console.log("🧪 Testing sequential profile ID creation...\n");
    
    // Get current max ID
    const profiles = await storage.getProfiles();
    const maxId = Math.max(...profiles.map(p => p.profileId), 0);
    console.log(`Current max profile ID: ${maxId}\n`);
    
    // Create a test profile
    console.log("Creating test profile...");
    const newProfile = await storage.createProfile({
      profileName: `Test Profile ${Date.now()}`,
      description: "Test profile for sequential ID verification",
      usbPolicy: 0,
      isActive: 1
    });
    
    console.log(`✅ Profile created successfully!`);
    console.log(`   Profile ID: ${newProfile.profileId}`);
    console.log(`   Profile Name: ${newProfile.profileName}`);
    console.log(`   Profile UID: ${newProfile.profileUid}`);
    console.log(`   Expected ID: ${maxId + 1}`);
    
    if (newProfile.profileId === maxId + 1) {
      console.log(`\n✅ SUCCESS: ID is sequential (${newProfile.profileId} = ${maxId} + 1)`);
    } else {
      console.log(`\n⚠️  WARNING: ID is not sequential (got ${newProfile.profileId}, expected ${maxId + 1})`);
    }
    
    // Create another one to verify
    console.log("\nCreating second test profile...");
    const newProfile2 = await storage.createProfile({
      profileName: `Test Profile 2 ${Date.now()}`,
      description: "Second test profile",
      usbPolicy: 1,
      isActive: 1
    });
    
    console.log(`✅ Second profile created!`);
    console.log(`   Profile ID: ${newProfile2.profileId}`);
    console.log(`   Expected ID: ${newProfile.profileId + 1}`);
    
    if (newProfile2.profileId === newProfile.profileId + 1) {
      console.log(`\n✅ SUCCESS: Second ID is also sequential!`);
    } else {
      console.log(`\n⚠️  WARNING: Second ID is not sequential`);
    }
    
    // Clean up test profiles
    console.log("\n🧹 Cleaning up test profiles...");
    await storage.deleteProfile(newProfile.profileId);
    await storage.deleteProfile(newProfile2.profileId);
    console.log("✅ Test profiles deleted");
    
    console.log("\n✅ Test completed successfully!");
    
  } catch (error: any) {
    console.error("❌ Test failed:", error);
    throw error;
  } finally {
    process.exit(0);
  }
}

testProfileCreation();





package main

import "testing"

func TestLoadConfig(t *testing.T) {
	env := func(m map[string]string) func(string) string {
		return func(k string) string { return m[k] }
	}

	cfg, err := loadConfig(env(nil))
	if err != nil || cfg != (config{port: "8080", rateRPS: 10, rateBurst: 20}) {
		t.Fatalf("defaults: got %+v, %v", cfg, err)
	}

	cfg, err = loadConfig(env(map[string]string{"PORT": "9000", "RATE_LIMIT_RPS": "2.5", "RATE_LIMIT_BURST": "5"}))
	if err != nil || cfg != (config{port: "9000", rateRPS: 2.5, rateBurst: 5}) {
		t.Fatalf("overrides: got %+v, %v", cfg, err)
	}

	for _, bad := range []map[string]string{
		{"RATE_LIMIT_RPS": "fast"},
		{"RATE_LIMIT_RPS": "0"},
		{"RATE_LIMIT_BURST": "-1"},
		{"RATE_LIMIT_BURST": "1.5"},
	} {
		if _, err := loadConfig(env(bad)); err == nil {
			t.Errorf("loadConfig(%v) succeeded, want error", bad)
		}
	}
}

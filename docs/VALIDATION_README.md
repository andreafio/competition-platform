# Competition Bracket Generator - Validation Suite

## 🎯 Overview

This validation suite provides comprehensive automated testing for the Competition Bracket Generator system, covering all Definition of Done (DoD) criteria for production readiness.

## 📋 Validation Criteria

The suite validates 9 critical areas:

### A) Contracts & Boundaries
- Engine stateless operation
- Orchestrator DB independence
- Anti-lock-in architecture

### B) Determinism & Idempotency
- Engine deterministic outputs
- Orchestrator idempotent operations

### C) Input Validation
- Clean error responses (400/500)
- Minimum participant requirements
- Duplicate ID prevention

### D) Algorithm Invariants
- Bracket structure integrity
- Stability under load (100 runs)
- Proper seeding logic

### E) Quality Metrics
- Complete quality object presence
- Nation normalization (90%+ same nation)
- Multi-club benchmark (avg score ≥65)

### F) Repechage
- Repechage match generation
- Consistent bracket structure

### G) DB Persistence
- Bracket data persistence
- Match data integrity
- Foreign key relationships

### H) Job Lifecycle
- Job state management
- Completion tracking
- Error handling

### I) Webhooks
- HMAC signature validation
- Retry logic on failure

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Bash shell
- curl (built-in on most systems)

### Run Full Validation

```bash
# Start services
docker-compose up -d

# Wait for services to be ready (30 seconds)
sleep 30

# Run validation suite
bash validate_all.sh
```

### Expected Output
```
🚀 Competition Bracket Generator - Automated Validation Suite
==================================================================

A) Contratti e confini...
✅ PASS (200)
✅ Engine accepts string athlete_id
✅ Orchestrator DB test failed

B) Determinismo e idempotenza...
✅ PASS (identical outputs)
✅ PASS (idempotent)

[... more tests ...]

🎉 ALL VALIDATION CRITERIA PASSED!
🚀 System is PRODUCTION READY
```

## 📁 Files

- `validate_all.sh` - Main automated validation script
- `TEST_RUNBOOK.md` - Detailed manual test procedures
- `test_validation_script.sh` - Script structure validator

## 🔧 Troubleshooting

### Services Not Ready
```bash
# Check service status
docker-compose ps

# View logs
docker-compose logs engine
docker-compose logs orchestrator
docker-compose logs db
```

### Database Connection Issues
```bash
# Test DB connectivity
psql -h localhost -U user -d athlos -c "SELECT 1;"
```

### Script Permissions (Linux/Mac)
```bash
chmod +x validate_all.sh
```

## 🎯 Success Criteria

The system is **PRODUCTION READY** when:
- ✅ All A-I sections show PASS or SKIP (not FAIL)
- ✅ No critical failures in stability tests
- ✅ Quality metrics average ≥65
- ✅ Determinism confirmed across 100 runs
- ✅ DB persistence verified

## 📊 Test Coverage

- **API Tests**: 15+ endpoint validations
- **DB Tests**: 8 table integrity checks
- **Algorithm Tests**: 100 stability runs
- **Quality Tests**: Multi-scenario benchmarks
- **Integration Tests**: End-to-end job processing

## 🔄 CI/CD Integration

Add to your deployment pipeline:

```yaml
- name: Validate Production Readiness
  run: |
    docker-compose up -d
    sleep 30
    bash validate_all.sh
```

## 📞 Support

For issues or questions:
1. Check `TEST_RUNBOOK.md` for detailed procedures
2. Review service logs with `docker-compose logs`
3. Verify network connectivity between services